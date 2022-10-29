/* eslint-disable no-use-before-define */
function createAsts(dbType) {
  const QUOTE = dbType === 'pg' ? '"' : '`';
  const casts = {
    int: 'INTEGER',
    string: 'VARCHAR',
    time: 'TIMESTAMPTZ',
  };
  const PRESERVED_FUNCTION_NAMES = ['EXISTS', 'NOT EXISTS'];

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

  const joinMap = {
    inner: 'INNER JOIN',
    left: 'LEFT JOIN',
    right: 'RIGHT JOIN',
    full: 'FULL JOIN',
    cross: 'CROSS JOIN',
  };

  function getNameParts(name, targetSize = 4) {
    const parts = name
      .split(new RegExp('\\.(?=(?:[^' + QUOTE + ']*|(?:' + QUOTE + '[^' + QUOTE + ']*' + QUOTE + '))+$)'))
      .map(t => t.replace(new RegExp(QUOTE, 'g'), ''));
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
    return names
      .reduce((sum, name) => {
        if (name) {
          if (name === '*') {
            sum.push('*');
          } else {
            sum.push(`${QUOTE}${name}${QUOTE}`);
          }
        }
        return sum;
      }, [])
      .join('.');
  }

  function getFunctionName(...names) {
    if (
      names.filter(t => !!t).length === 1 &&
      PRESERVED_FUNCTION_NAMES.includes(names[names.length - 1])
    ) {
      return names[names.length - 1];
    }
    if (dbType === 'pg') {
      return joinNameParts(...names);
    } else {
      return [...joinNameParts(...names.slice(0, names.length - 2)), names[names.length - 1]].join('.');
    }
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
    if (
      oexpr instanceof ExprAst ||
      oexpr instanceof FunctionAst ||
      oexpr instanceof ColumnRefAst ||
      oexpr instanceof IdentifierAst
    )
      return oexpr;
    let ast;
    if (oexpr.$right) {
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
      const keys = Reflect.ownKeys(oexpr);
      if (keys.length === 0) {
        return null;
      }
      const lastKey = keys[keys.length - 1];
      const { [lastKey]: last, ...rest } = oexpr;
      if (typeof lastKey === 'symbol' || lastKey.startsWith('$')) {
        ast = parseExprObject(last);
      } else {
        if (last instanceof Array) {
          ast = new ExprAst(new ColumnRefAst(lastKey), 'IN', resolveValue(last));
        } else if (last instanceof Ast) {
          ast = new ExprAst(new ColumnRefAst(lastKey), '=', last);
        } else if (
          last !== null &&
          typeof last === 'object' &&
          Object.getPrototypeOf(last) === Object.getPrototypeOf({})
        ) {
          const ops = Object.keys(last);
          if (ops.length > 0) {
            ast = new ExprAst(new ColumnRefAst(lastKey), ops[0], last[ops[0]]);
          }
          for (let i = 1; i < ops.length; i++) {
            ast.op(
              'AND',
              new ExprAst(new ColumnRefAst(lastKey), ops[i], last[ops[i]])
            );
          }
        } else {
          ast = new ExprAst(new ColumnRefAst(lastKey), '=', last);
        }
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
      this._db = dbType;
      this._toParamsMap = {
        pg: 'toPgParams',
        mysql: 'toMysqlParams',
      };
    }
    setDb(db) {
      if (!['pg', 'mysql'].includes(db)) {
        throw new Error('o2sql: ' + db + ' not supported');
      }
      this._db = db;
    }
    toParams() {
      return this[this._toParamsMap[this._db]](...arguments);
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

    or(right = null) {
      return this.op('OR', right);
    }

    and(right = null) {
      return this.op('AND', right);
    }

    toParams(
      params = { sql: '', values: [] },
      { parentheses = false, separator = '' } = {}
    ) {
      if (parentheses) {
        params.sql += '(';
      }
      params.sql += separator;
      if (this.type === 'null') {
        params.sql += 'NULL';
      } else {
        params.sql += `$${params.values.length + 1}`;
        params.values.push(this.value);
      }

      if (parentheses) {
        params.sql += ')';
      }
      return params;
    }
  }

  class ExprAst extends Ast {
    constructor(left, op, right = null) {
      super('expr');
      if (!op && !right) {
        Object.assign(this, parseExprObject(left));
      } else {
        if (left) {
          this.left = left instanceof Ast ? left : resolveValue(left);
        }
        this.right = right instanceof Ast ? right : resolveValue(right);
        this.operator = op && (ops[op] || op);
        if (this.right.type === 'null') {
          if (this.operator === '=') {
            this.operator = 'IS';
          } else if (this.operator === '<>') {
            this.operator = 'IS NOT';
          }
        }
      }
    }

    clone() {
      return new ExprAst(this.left, this.operator, this.right);
    }

    op(op, right = null) {
      op = op.toUpperCase();
      this.left = this.clone();
      this.right = right instanceof Ast ? right : new ValueAst(right);
      if (this.right instanceof ValueAst && this.right.type === 'null') {
        if (op === '=') {
          this.operator = 'IS';
        } else if (op === '<>') {
          this.operator = 'IS NOT';
        } else {
          this.operator = op;
        }
      } else {
        this.operator = op;
      }

      return this;
    }

    or(right = null) {
      this.op('OR', right);
      return this;
    }

    and(right = null) {
      this.op('AND', right);
      return this;
    }

    toPgParams(
      params = { sql: '', values: [] },
      { parentheses = false, separator = '', getDefaultTable = () => '' } = {}
    ) {
      params.sql += parentheses ? '(' : '';
      params.sql += separator;
      if (this.left) {
        this.left.toParams(params, {
          parentheses:
            this.left instanceof ExprAst
              ? precedenceMap[this.left.operator] > precedenceMap[this.operator]
              : undefined,
          getDefaultTable,
        });
      }
      let forceParentheses = false;
      if (this.operator) {
        if (this.operator === 'IN') {
          params.sql += '=ANY';
          forceParentheses = true;
        } else if (this.operator === 'NOT IN') {
          params.sql += '<>ANY';
          forceParentheses = true;
        } else {
          params.sql += ' ' + this.operator + ' ';
        }
      }
      this.right.toParams(params, {
        parentheses:
          forceParentheses ||
          (this.right instanceof ExprAst
            ? precedenceMap[this.right.operator] > precedenceMap[this.operator]
            : undefined),
        getDefaultTable,
      });

      if (parentheses) {
        params.sql += ')';
      }

      return params;
    }

    toMysqlParams(
      params = { sql: '', values: [] },
      { parentheses = false, separator = '', getDefaultTable = () => '' } = {}
    ) {
      params.sql += parentheses ? '(' : '';
      params.sql += separator;
      if (this.left) {
        this.left.toParams(params, {
          parentheses:
            this.left instanceof ExprAst
              ? precedenceMap[this.left.operator] > precedenceMap[this.operator]
              : undefined,
          getDefaultTable,
        });
      }
      if (this.operator) {
        params.sql += ' ' + this.operator + ' ';
      }
      this.right.toParams(params, {
        parentheses:
          (this.right instanceof ExprAst
            ? precedenceMap[this.right.operator] > precedenceMap[this.operator]
            : undefined),
        getDefaultTable,
      });

      if (parentheses) {
        params.sql += ')';
      }

      return params;
    }
  }

  class ExprListAst extends Ast {
    constructor(list, cast) {
      super('expr_list');
      if (!cast) {
        console.dir(list);
        if (typeof list[0] === 'string') {
          cast = 'string';
        } else if (typeof list[0] === 'number') {
          cast = 'int';
        } else {
          throw new Error('[o2sql] Unsupported value type');
        }
      }
      this.value = list.map(t => resolveValue(t));
      this.cast = casts[cast];
    }

    toPgParams(
      params = { sql: '', values: [] },
      { parentheses = false, getDefaultTable = () => '' } = {}
    ) {
      if (parentheses) {
        params.sql += '(';
      }
      params.sql += 'ARRAY[';
      this.value.forEach((t, index) => {
        t.toParams(params, { separator: index ? ',' : '', getDefaultTable });
      });
      params.sql += ']::' + this.cast + '[]';

      if (parentheses) {
        params.sql += ')';
      }
      return params;
    }

    toMysqlParams(
      params = { sql: '', values: [] },
      { getDefaultTable = () => '' } = {}
    ) {
      params.sql += '(';
      this.value.forEach((t, index) => {
        t.toParams(params, { separator: index ? ',' : '', getDefaultTable });
      });

      params.sql += ')';
      return params;
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

    op(op, right) {
      return new ExprAst(this, op, right);
    }

    or(right = null) {
      return this.op('OR', right);
    }

    and(right = null) {
      return this.op('AND', right);
    }

    toParams(
      params = { sql: '', values: [] },
      { getDefaultTable = () => '' } = {}
    ) {
      params.sql +=
        getFunctionName(this.db, this.schema, this.table, this.name) + '(';
      this.args.forEach((t, index) => {
        params.sql += index ? ',' : '';
        t.toParams(params, { getDefaultTable });
      });
      params.sql += ')';

      return params;
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

    or(right = null) {
      return this.op('OR', right);
    }

    and(right = null) {
      return this.op('AND', right);
    }

    toParams(
      params = { sql: '', values: [] },
      { separator = '', getDefaultTable = () => '' } = {}
    ) {
      if (this.name.length === 1 || this.name[this.name.length - 2] === null) {
        params.sql +=
          separator +
          joinNameParts(
            getDefaultTable(this.name[this.name.length - 1]),
            this.name[this.name.length - 1]
          );
      } else {
        params.sql += separator + joinNameParts(...this.name);
      }
      return params;
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

    toParams(
      params = { sql: '', values: [] },
      { getDefaultTable = () => '' } = {}
    ) {
      params.sql += joinNameParts(
        this.db,
        this.schema,
        this.table || getDefaultTable(this.column),
        this.column
      );

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

    toParams(
      params = { sql: '', values: [] },
      { separator = '', getDefaultTable = () => '' } = {}
    ) {
      params.sql += separator;
      if (this.cast) {
        params.sql += 'CAST(';
        this.column.toParams(params, { getDefaultTable });
        params.sql += ' AS ' + this.cast + ')';
      } else {
        this.column.toParams(params, { getDefaultTable });
      }
      if (this.alias) {
        params.sql += ` ${QUOTE}${this.alias}${QUOTE}`;
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
      this.order = order.toUpperCase();
    }

    toParams(
      params = { sql: '', values: [] },
      { separator = '', getDefaultTable = () => '' } = {}
    ) {
      params.sql += separator;
      this.column.toParams(params, { getDefaultTable });
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

    toParams(params = { sql: '', values: [] }) {
      params.sql += joinNameParts(this.db, this.schema, this.table);

      return params;
    }
  }

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
      } else if (opts instanceof Ast) {
        table = opts;
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

    leftJoin(table, on) {
      return this._join(table, 'left', on);
    }

    rightJoin(table, on) {
      return this._join(table, 'right', on);
    }

    fullJoin(table, on) {
      return this._join(table, 'full', on);
    }

    crossJoin(table) {
      return this._join(table, 'cross');
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
      this.join = {
        type: join,
        table: table instanceof TableAst ? table : new TableAst(table),
      };
      if (join !== 'cross') {
        let cond = on;
        if (on instanceof Array) {
          cond = {
            left: new IdentifierAst(on[0]),
            op: '=',
            right: new IdentifierAst(on[1]),
          };
        }
        this.join.on =
          cond instanceof ExprAst
            ? cond
            : new ExprAst(cond.left, cond.op, cond.right);
      }
      return this;
    }

    toParams(
      params = { sql: '', values: [] },
      { getDefaultTable = () => '' } = {}
    ) {
      this.table.toParams(params);
      if (this.alias) {
        params.sql += ` ${QUOTE}${this.alias}${QUOTE}`;
      }
      if (this.join) {
        params.sql += ' ' + joinMap[this.join.type] + ' ';
        if (this.join.table.join) {
          params.sql += '(';
        }
        this.join.table.toParams(params);
        if (this.join.on) {
          params.sql += ' ON ';
          this.join.on.toParams(params, { getDefaultTable });
        }
        if (this.join.table.join) {
          params.sql += ')';
        }
      }

      return params;
    }
  }

  return {
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
}

module.exports = {
  pg: createAsts('pg'),
  mysql: createAsts('mysql'),
}
