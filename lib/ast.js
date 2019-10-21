const casts = {
  int: 'INTEGER',
  string: 'VARCHAR',
  time: 'TIMESTAMPTZ',
};

const precedenceMap = {};
[
  ['.'],
  ['::'],
  ['[', ']'],
  ['+', '-'],
  ['^'],
  ['*', '/', '%'],
  ['+', '-'],
  ['BETWEEN', 'IN', 'LIKE', 'ILIKE', 'SIMILAR'],
  ['<', '>', '=', '<=', '>=', '<>'],
  ['IS', 'ISNULL', 'NOTNULL'],
  ['NOT'],
  ['AND'],
  ['OR'],
].forEach((row, index) => {
  row.forEach(t => {
    precedenceMap[t] = index;
  });
});

const ops = {
  '!=': '<>',
};

function getNameParts(name, targetSize = 4) {
  const parts = name
    .split(/\.(?=(?:[^"]*|(?:"[^"]*"))+$)/)
    .map(t => t.replace(/"/g, ''));
  if (targetSize > 0) {
    if (parts.length > targetSize) {
      throw new Error('[o2sql] name parts invalid');
    }

    while (parts.length < targetSize) {
      parts.unshift(null);
    }
  }
  return parts;
}

function joinNameParts(...names) {
  return '"' + names.filter(t => t).join('"."') + '"';
}

function resolveValue(value) {
  if (value instanceof Array) {
    return new ExprListAst(value);
  }
  if (value instanceof Ast) {
    return value;
  }
  return new ValueAst(value);
}

function parseExprObject(oexpr) {
  let ast;
  if (oexpr.$left) {
    ast = new ExprAst(oexpr.$left, oexpr.$op, oexpr.$right);
  } else if (oexpr instanceof Array) {
    const last = oexpr[oexpr.length - 1];
    ast = parseExprObject(last);
    if (oexpr.length > 1) {
      ast = new ExprAst(
        parseExprObject(oexpr.slice(0, oexpr.length - 1)),
        'OR',
        ast
      );
    }
  } else if (typeof oexpr === 'object') {
    const keys = Object.keys(oexpr);
    const lastKey = keys[keys.length - 1];
    const { [lastKey]: last, ...rest } = oexpr;
    if (lastKey.startsWith('$')) {
      ast = parseExprObject(last);
    } else {
      ast = new ExprAst(
        new ColumnRefAst(lastKey),
        last instanceof Array ? 'IN' : '=',
        resolveValue(last)
      );
    }
    if (keys.length > 1) {
      ast = new ExprAst(parseExprObject(rest), 'AND', ast);
    }
  }

  return ast;
}

class Ast {
  constructor(type) {
    this.type = type;
  }

  toString() {
    return JSON.stringify(this, 2, 2);
  }
}

class ValueAst extends Ast {
  constructor(value) {
    super(value === null ? 'null' : typeof value);
    this.value = value;
  }

  op(op, right) {
    return new ExprAst(this, op, right);
  }

  toParams(params, { separator = '' } = {}) {
    params.sql += separator;
    if (this.type === 'null') {
      params.sql += 'NULL';
    } else {
      params.sql += `$${params.values.length + 1}`;
      params.values.push(this.value);
    }
  }
}

class ExprAst extends Ast {
  constructor(left, op, right) {
    super('expr');
    if (!op && !right) {
      Object.assign(this, parseExprObject(left));
    } else {
      this.left = left instanceof Ast ? left : new ValueAst(left);
      this.right = right instanceof Ast ? right : new ValueAst(right);
      this.op = ops[op] || op;
    }
  }

  clone() {
    return new ExprAst(this.left, this.op, this.right);
  }

  op(op, right = null) {
    this.left = this.clone();
    this.right = right instanceof Ast ? right : new ValueAst(right);
    if (this.right instanceof ValueAst && this.right.type === 'null') {
      if (op === '=') {
        this.op = 'IS';
      } else if (op === '<>') {
        this.op = 'IS NOT';
      } else {
        this.op = op;
      }
    } else {
      this.op = op;
    }

    return this;
  }

  parse(oexpr) {}

  toParams(params, { parentheses = false, separator = '' } = {}) {
    params.sql += parentheses ? '(' : '';
    params.sql += separator;
    this.left.toParams(params, {
      parentheses:
        this.left instanceof ExprAst
          ? precedenceMap[this.left.op] > precedenceMap[this.op]
          : undefined,
    });
    params.sql += ' ' + this.op + ' ';
    this.right.toParams(params, {
      parentheses:
        this.right instanceof ExprAst
          ? precedenceMap[this.right.op] > precedenceMap[this.op]
          : undefined,
    });
    if (parentheses) {
      params.sql += ')';
    }

    return params;
  }
}

class ExprListAst extends Ast {
  constructor(list) {
    super('expr_list');
    this.value = list.map(t => resolveValue(t));
  }

  toParams(params) {
    params.sql += '[';
    this.value.map((t, index) => {
      t.toParams(params, { separator: index ? ',' : '' });
    });
    params.sql += ']';
  }
}

class FunctionAst extends Ast {
  constructor(name, ...args) {
    super('function');
    const nameParts = getNameParts(name, 3);
    this.db = nameParts[0];
    this.schema = nameParts[1];
    this.name = nameParts[2];

    this.args = args.map(t => {
      if (t instanceof Ast) {
        return t;
      }
      return resolveValue(t);
    });
  }
}

class IdentifierAst extends Ast {
  constructor(name) {
    super('identifier');
    this.name = getNameParts(name, 0);
  }

  op(op, right) {
    return new ExprAst(this, op, right);
  }

  toParams(params, { separator = '' } = {}) {
    params.sql += separator + joinNameParts(...this.name);
  }
}

class ColumnRefAst extends Ast {
  constructor(name) {
    super('table_ref');
    if (typeof name === 'string') {
      const nameParts = getNameParts(name, 4);
      this.db = nameParts[0];
      this.schema = nameParts[1];
      this.table = nameParts[2];
      this.column = nameParts[3];
    } else if (name instanceof Array) {
      this.db = name[0];
      this.schema = name[1];
      this.table = name[2];
      this.column = name[3];
    } else if (typeof name === 'object' && name.column) {
      this.db = name.db || null;
      this.schema = name.schema || null;
      this.table = name.table || null;
      this.column = name.column || null;
    } else {
      throw new Error('[o2sql] invalid columnref');
    }
  }

  toParams(params) {
    params.sql += joinNameParts(this.db, this.schema, this.table, this.column);

    return params;
  }
}

class ColumnAst extends Ast {
  constructor(opts) {
    super('column');
    let column;
    let alias;
    let cast;
    if (typeof opts === 'string' || opts instanceof Ast) {
      column = opts;
    } else if (opts instanceof Array) {
      [column, alias = null, cast = null] = opts;
    } else if (typeof opts === 'object') {
      ({ column, alias = null, cast = null } = opts);
    }

    this.alias = alias;
    this.cast = casts[cast] || cast;
    if (column instanceof Ast) {
      this.column = column;
    } else if (
      column &&
      (typeof column === 'string' || typeof column === 'object')
    ) {
      this.column = new ColumnRefAst(column);
    } else {
      throw new Error('[o2sql] invalid column');
    }
  }

  toParams(params, { separator = '' } = {}) {
    params.sql += separator;
    if (this.cast) {
      params.sql += 'CAST(';
      this.column.toParams(params);
      params.sql += ' AS ' + this.cast + ')';
    } else {
      this.column.toParams(params);
    }
    if (this.alias) {
      params.sql += ' "' + this.alias + '"';
    }

    return params;
  }
}

class OrderbyColumnAst extends Ast {
  constructor(opts) {
    super('column');
    let column;
    let order;
    if (typeof opts === 'string') {
      if (opts.startsWith('-')) {
        column = opts.substr(1);
        order = 'DESC';
      } else {
        column = opts;
        order = 'ASC';
      }
    } else if (opts instanceof Array) {
      [column, order = 'ASC'] = opts;
    } else if (typeof opts === 'object') {
      ({ column, order = 'ASC' } = opts);
    }

    if (column instanceof Ast) {
      this.column = column;
    } else if (
      column &&
      (typeof column === 'string' || typeof column === 'object')
    ) {
      this.column = new IdentifierAst(column);
    } else {
      throw new Error('[o2sql] invalid order by column');
    }
    this.order = order;
  }

  toParams(params, { separator = '' } = {}) {
    params.sql += separator;
    this.column.toParams(params);
    params.sql += ' ' + this.order;

    return params;
  }
}

class TableRefAst extends Ast {
  constructor(name) {
    super('table_ref');
    const nameParts = getNameParts(name, 3);
    this.db = nameParts[0];
    this.schema = nameParts[1];
    this.table = nameParts[2];
  }

  toParams(params) {
    params.sql += joinNameParts(this.db, this.schema, this.table);

    return params;
  }
}

const joinMap = {
  inner: 'INNER JOIN',
  outer: 'OUTER JOIN',
  left: 'LEFT JOIN',
  right: 'RIGHT JOIN',
};
class TableAst extends Ast {
  constructor(opts) {
    super('table');
    let table;
    let alias;
    let join;
    if (typeof opts === 'string') {
      table = opts;
    } else if (opts instanceof Array) {
      [table, alias = null, join = null] = opts;
    } else if (typeof opts === 'object') {
      ({ table, alias = null, join = null } = opts);
    }

    this.alias = alias;
    this.join = join;
    if (table instanceof Ast) {
      this.table = table;
    } else if (table && typeof table === 'string') {
      this.table = new TableRefAst(table);
    } else {
      throw new Error('[o2sql] invalid table');
    }
  }

  innerJoin(table, on) {
    return this._join(table, 'inner', on);
  }

  outerJoin(table, on) {
    return this._join(table, 'outer', on);
  }

  leftJoin(table, on) {
    return this._join(table, 'left', on);
  }

  rightJoin(table, on) {
    return this._join(table, 'right', on);
  }

  _join(table, join, on) {
    if (this.join) {
      this.table = new TableAst({
        alias: this.alias,
        table: this.table,
        join: this.join,
      });
      this.alias = null;
      this.join = null;
    }
    let cond = on;
    if (on instanceof Array) {
      cond = {
        left: new IdentifierAst(on[0]),
        op: '=',
        right: new IdentifierAst(on[1]),
      };
    }
    this.join = {
      type: join,
      table: table instanceof TableAst ? table : new TableAst(table),
      on:
        on instanceof ExprAst
          ? cond
          : new ExprAst(cond.left, cond.op, cond.right),
    };
    return this;
  }

  toParams(params) {
    console.dir(this.table);
    this.table.toParams(params);
    if (this.alias) {
      params.sql += ' ' + this.alias;
    }
    if (this.join) {
      params.sql += ' ' + joinMap[this.join.type] + ' ';
      if (this.join.table.join) {
        params.sql += '(';
      }
      this.join.table.toParams(params);
      params.sql += ' ON ';
      this.join.on.toParams(params);
      if (this.join.table.join) {
        params.sql += ')';
      }
    }
  }
}

module.exports = {
  Ast,
  ValueAst,
  ExprAst,
  ExprListAst,
  FunctionAst,
  IdentifierAst,
  ColumnRefAst,
  ColumnAst,
  OrderbyColumnAst,
  TableRefAst,
  TableAst,
  resolveValue,
  parseExprObject,
};
