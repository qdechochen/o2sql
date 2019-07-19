'use strict';

const has = (obj, key) => key in obj;

const escapeMap = {
  '\0': '\\0',
  "'": "\\'",
  '"': '\\"',
  '\b': '\\b',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\x1a': '\\Z', // EOF
  '\\': '\\\\',
};

function escape(str) {
  const res = [];
  let char;

  for (let i = 0, l = str.length; i < l; ++i) {
    char = str[i];
    const escaped = escapeMap[char];
    if (escaped) char = escaped;
    res.push(char);
  }

  return res.join('');
}

function identifierToSql(ident) {
  return `"${ident}"`;
}

class AST2Sql {
  constructor(ast) {
    this.ast = ast;
    this.values = [];
    this.exprToSQLConvertFn = {
      array: 'arrayToSQL',
      aggr_func: 'aggrToSQL',
      binary_expr: 'binaryToSQL',
      case: 'caseToSQL',
      cast: 'castToSQL',
      column_ref: 'columnRefToSQL',
      expr_list: 'exprList',
      function: 'funcToSQL',
      select: 'select',
      unary_expr: 'unaryToSQL',
      var: 'var',
    };
  }

  arrayToSQL(literal, transformArray = true) {
    // const { type } = literal;
    const { value } = literal;
    let str;
    const start = this.values.length + 1;
    this.values.push(...value);
    if (transformArray) {
      str = 'ARRAY[' + value.map((t, i) => `$${start + i}`).join(',') + ']';
      if (value.type) {
        str += '::' + value.type + '[]';
      } else if (typeof value[0] === 'string') {
        str += '::VARCHAR[]';
      } else if (typeof value[0] === 'number' && ~~value[0] === value[0]) {
        str += '::INTEGER[]';
      }
    } else {
      str = value.map((t, i) => `$${start + i}`).join(',');
    }
    return !literal.parentheses ? str : '(' + str + ')';
  }

  literalToSQL(literal) {
    // const { type } = literal;
    const { value, type } = literal;

    /*
    if (type === 'number') {
      // nothing
    } else if (type === 'string') value = '\'' + escape(value) + '\'';
    else if (type === 'bool') value = value ? 'TRUE' : 'FALSE';
    else if (type === 'null') value = 'NULL';
    else if (type === 'star') value = '*';
    else if (['time', 'date', 'timestamp'].includes(type)) value = `${type.toUpperCase()} '${value}'`;
    else if (type === 'param') value = ':' + value;
    */
    if (type === 'star') {
      return '*';
    }
    const str = `$${this.values.length}`;
    this.values.push(value);
    return !literal.parentheses ? `$${this.values.length}` : '(' + str + ')';
  }

  // let exprToSQLConvertFn = {};

  exprToSQL(expr, ...args) {
    return this.exprToSQLConvertFn[expr.type]
      ? this[this.exprToSQLConvertFn[expr.type]](expr, ...args)
      : this.literalToSQL(expr, ...args);
  }

  aggrToSQL(expr) {
    /** @type {Object} */
    const args = expr.args;
    let str = this.exprToSQL(args.expr);
    const fnName = expr.name;

    if (fnName === 'COUNT') {
      if (has(args, 'distinct') && args.distinct !== null) {
        str = 'DISTINCT ' + str;
      }
    }

    return fnName + '(' + str + ')';
  }

  binaryToSQL(expr) {
    let operator = expr.operator;
    let rstr;
    if (expr.right.type === 'null') {
      rstr = 'NULL';
      if (operator === '=') {
        operator = 'IS';
      } else if (operator === '<>' || operator === '!=') {
        operator = 'IS NOT';
      }
    } else if (expr.right.type === 'expr_list') {
      if (operator === '=') {
        operator = 'IN';
      } else if (operator === '!=' || operator === '<>') {
        operator = 'NOT IN';
      }
      if (operator === 'IN' || operator === 'NOT IN') {
        rstr = '(' + this.exprToSQL(expr.right, false) + ')';
      } else if (operator === 'BETWEEN' || operator === 'NOT BETWEEN') {
        rstr = this.exprToSQL(expr.right, false);
        rstr = rstr[0] + ' AND ' + rstr[1];
      } else if (['&&', '@>', '<@'].includes(operator)) {
        let itemType = expr.right.itemType;
        if (!itemType && expr.right.value[0].type === 'number' && ~~expr.right.value[0].type === expr.right.value[0].type) {
          itemType = 'INTEGER';
        }
        rstr = this.exprToSQL({
          type: 'array',
          value: expr.right.value.map(t => t.value),
          itemType,
        });
      } else {
        rstr = this.exprToSQL(expr.right);
      }
    } else {
      rstr = this.exprToSQL(expr.right);
    }

    const str =
      this.exprToSQL(expr.left) +
      ' ' +
      operator +
      ' ' +
      (expr.right.type === 'select' ? `(${rstr})` : rstr);
    return !expr.parentheses ? str : '(' + str + ')';
  }

  caseToSQL(expr) {
    const res = ['CASE'];
    const conditions = expr.args;

    if (expr.expr) res.push(this.exprToSQL(expr.expr));

    for (let i = 0, l = conditions.length; i < l; ++i) {
      res.push(conditions[i].type.toUpperCase()); // when/else
      if (conditions[i].cond) {
        res.push(this.exprToSQL(conditions[i].cond));
        res.push('THEN');
      }
      res.push(this.exprToSQL(conditions[i].result));
    }

    res.push('END');

    return res.join(' ');
  }

  castToSQL(expr) {
    let str = 'CAST(';
    str += this.exprToSQL(expr.expr) + ' AS ';
    str +=
      expr.target.dataType +
      (expr.target.length ? '(' + expr.target.length + ')' : '');
    str += ')';

    return str;
  }

  columnRefToSQL(expr) {
    let str = expr.column !== '*' ? identifierToSql(expr.column) : '*';
    const table =
      (has(expr, 'table') && expr.table !== null
        ? expr.table
        : this.ast.mainTable) || null;
    if (table) str = identifierToSql(table) + '.' + str;
    return !expr.parentheses ? str : '(' + str + ')';
  }

  getExprListSQL(exprList) {
    return exprList.map(item => this.exprToSQL(item));
  }

  funcToSQL(expr) {
    const str =
      '"' + expr.name + '"(' + this.exprToSQL(expr.args).join(', ') + ')';
    return !expr.parentheses ? str : '(' + str + ')';
  }

  /**
   * Stringify column expressions
   *
   * @param {Array} columns
   * @return {string}
   */
  columnsToSQL(columns) {
    if (!columns) return '*';
    return columns
      .map(column => {
        let str;
        if (
          typeof column.expr.column === 'object' &&
          column.expr.column.type === 'select'
        ) {
          str = '(' + this.selectToSQL(column.expr.column) + ')';
        } else {
          str = this.exprToSQL(column.expr);
        }
        if (column.castas) {
          str += '::' + column.castas;
        }

        if (column.as !== null) {
          str += ' AS ';
          if (column.as.match(/^[a-z_][0-9a-z_]*$/i)) {
            str += identifierToSql(column.as);
          } else str += '"' + column.as + '"';
        }

        return str;
      })
      .join(', ');
  }

  /**
   * @param {Array} tables
   * @return {string}
   */
  tablesToSQL(from) {
    if (from.type === 'table_ref') {
      return this.tableToSQL(from);
    }
    const operator = from.operator;
    const lstr =
      from.left.type === 'table_join'
        ? this.tablesToSQL(from.left)
        : this.tableToSQL(from.left);

    const rstr =
      from.right.type === 'table_join'
        ? this.tablesToSQL(from.right)
        : this.tableToSQL(from.right);

    const onStr = this.exprToSQL(from.on);
    const str = lstr + ' ' + operator + ' ' + rstr + ' ON ' + onStr;
    return !from.parentheses ? str : '(' + str + ')';
  }

  /**
   * @param {string} table
   * @return {string}
   */
  tableToSQL(table) {
    if (table.type === 'table_ast') {
      const { sql, values } = new AST2Sql(table.table).toParams(this.values);
      this.values = values;
      return '(' + sql + ') ' + identifierToSql(table.as);
    }

    if (table.type === 'table_ref') {
      return (
        identifierToSql(table.table) +
        (table.as ? ' ' + identifierToSql(table.as) : '')
      );
    }
    return null;
  }

  /**
   * @param {Object}          stmt
   * @param {?Array}          stmt.options
   * @param {?string}         stmt.distinct
   * @param {?Array|string}   stmt.columns
   * @param {?Array}          stmt.from
   * @param {?Object}         stmt.where
   * @param {?Array}          stmt.groupby
   * @param {?Object}         stmt.having
   * @param {?Array}          stmt.orderby
   * @param {?Array}          stmt.limit
   * @return {string}
   */
  selectToSQL(stmt) {
    const clauses = [];

    if (has(stmt, 'options') && Array.isArray(stmt.options)) {
      clauses.push(stmt.options.join(' '));
    }
    if (has(stmt, 'distinct') && stmt.distinct instanceof Array) {
      if (stmt.distinct.length === 0) {
        clauses.push('distinct');
      } else {
        clauses.push(
          'distinct on (',
          this.getExprListSQL(stmt.distinct).join(', '),
          ')'
        );
      }
    }

    if (stmt.columns !== '*') clauses.push(this.columnsToSQL(stmt.columns));
    else clauses.push('*');

    if (stmt.type === 'count') {
      clauses.unshift('count(');
      clauses.push(')::INTEGER AS count');
    }

    clauses.unshift('SELECT');
    // FROM + joins
    if (stmt.from) clauses.push('FROM', this.tablesToSQL(stmt.from));
    if (has(stmt, 'where') && stmt.where !== null) {
      clauses.push('WHERE ' + this.exprToSQL(stmt.where));
    }
    if (Array.isArray(stmt.groupby)) {
      clauses.push('GROUP BY', this.getExprListSQL(stmt.groupby).join(', '));
    }
    if (has(stmt, 'having') && stmt.having !== null) {
      clauses.push('HAVING ' + this.exprToSQL(stmt.having));
    }

    if (Array.isArray(stmt.orderby)) {
      const orderExpressions = stmt.orderby.map(
        expr => this.exprToSQL(expr.expr) + ' ' + expr.type
      );
      clauses.push('ORDER BY', orderExpressions.join(', '));
    }

    if (has(stmt, 'limit')) clauses.push('LIMIT', this.exprToSQL(stmt.limit));

    if (has(stmt, 'skip')) clauses.push('OFFSET', this.exprToSQL(stmt.skip));

    return clauses.join(' ');
  }

  unaryToSQL(expr) {
    const str = expr.operator + ' ' + this.exprToSQL(expr.expr);
    return !expr.parentheses ? str : '(' + str + ')';
  }

  unionToSQL(stmt) {
    const res = [this.selectToSQL(stmt)];

    while (stmt._next) {
      const { sql, values } = new AST2Sql(stmt._next).toParams(this.values);
      this.values = values;
      res.push('UNION', sql);
      stmt = stmt._next;
    }
    return res.join(' ');
  }

  insertToSQL(stmt) {
    const clauses = ['INSERT INTO'];
    if (stmt.table) clauses.push(identifierToSql(stmt.table));
    if (stmt.columns) {
      clauses.push('(' + stmt.columns.map(identifierToSql) + ')');
    }
    clauses.push('VALUES');
    if (stmt.values) {
      clauses.push(
        stmt.values
          .map(
            row =>
              '(' +
              row.value
                .map(value => {
                  let sql;
                  if (value.type === 'expr_list') {
                    sql = this.exprToSQL(value);
                  } else if (value.type === 'select') {
                    sql = `(${this.unionToSQL(value)})`;
                  } else {
                    sql = this.literalToSQL(value);
                  }
                  return sql;
                })
                .join(',') +
              ')'
          )
          .join(',')
      );
    }
    if (stmt.returning) {
      clauses.push('RETURNING', this.columnsToSQL(stmt.returning));
    }
    return clauses.join(' ');
  }

  updateToSQL(stmt) {
    if (!('where' in stmt) || !stmt.where) {
      throw new Error('WHERE is required for UPDATE');
    }
    const clauses = ['UPDATE'];
    if (stmt.table) clauses.push(identifierToSql(stmt.table));
    if (stmt.set) {
      clauses.push(
        'SET',
        stmt.set
          .map(value => {
            let sql = identifierToSql(value.column) + '=';
            if (['expr_list', 'function'].includes(value.value.type)) {
              sql += this.exprToSQL(value.value);
            } else if (value.value.type === 'select' || value.value.type === 'count') {
              sql += `(${this.unionToSQL(value.value)})`;
            } else {
              sql += this.literalToSQL(value.value);
            }
            return sql;
          })
          .join(', ')
      );
    }
    if (has(stmt, 'where') && stmt.where !== null) {
      clauses.push('WHERE ' + this.exprToSQL(stmt.where));
    }
    if (stmt.returning) {
      clauses.push('RETURNING', this.columnsToSQL(stmt.returning));
    }
    return clauses.join(' ');
  }

  deleteToSQL(stmt) {
    if (!('where' in stmt)) {
      throw new Error('WHERE is required for DELETE');
    }
    const clauses = ['DELETE FROM'];
    if (stmt.table) clauses.push(identifierToSql(stmt.table));
    if (has(stmt, 'where') && stmt.where !== null) {
      clauses.push('WHERE ' + this.exprToSQL(stmt.where));
    } else {
      throw new Error('delete without where is forbidden');
    }
    return clauses.join(' ');
  }

  exprList(expr) {
    const str = this.getExprListSQL(expr.value);
    return !expr.parentheses ? str : `(${str})`;
  }

  select(expr) {
    const str =
      typeof expr._next !== 'object'
        ? this.selectToSQL(expr)
        : this.unionToSQL(expr);
    return !expr.parentheses ? str : `(${str})`;
  }

  var(expr) {
    return `$${expr.name}`;
  }

  toSelectParams(values) {
    if (values) {
      this.values = values;
    }
    if (!['select'].includes(this.ast.type)) {
      throw new Error('command not select');
    }
    const sql = this.unionToSQL(this.ast);

    return {
      sql,
      values: this.values,
    };
  }

  toParams(values) {
    if (values) {
      this.values = values;
    }
    if (!['select', 'count', 'insert', 'update', 'delete'].includes(this.ast.type)) {
      throw new Error('command not supported');
    }
    let sql;
    if (this.ast.type === 'select' || this.ast.type === 'count') {
      sql = this.unionToSQL(this.ast);
    } else if (this.ast.type === 'insert') {
      sql = this.insertToSQL(this.ast);
    } else if (this.ast.type === 'update') {
      sql = this.updateToSQL(this.ast);
    } else if (this.ast.type === 'delete') {
      sql = this.deleteToSQL(this.ast);
    }

    return {
      sql,
      values: this.values,
    };
  }
}
module.exports = function toParams(ast) {
  return new AST2Sql(ast).toParams();
};
