const ast2sql = require('./ast2sql');
const parse = require('./pegjs-parser').parse;

function capFirstLetter(s) {
  return s[0].toUpperCase() + s.substring(1);
}

function resolveColumnName(column) {
  return column.includes('.') ? column.split('.') : [null, column];
}

function resolveTableName(table) {
  return table.includes('.') ? table.split('.') : [null, table];
}

function resolveField(column) {
  const columns = [];
  if (typeof column === 'object' && !(column instanceof Array)) {
    const {
      table, prefix, separator, fields
    } = column;
    fields.forEach((field) => {
      const [subColumn] = resolveField(field);
      if (!subColumn.alias) {
        subColumn.alias = subColumn.column;
      }
      columns.push({
        table,
        column: subColumn.column,
        expr: subColumn.expr,
        alias: prefix
          + (separator ? (separator + subColumn.alias) : capFirstLetter(subColumn.alias)),
      });
    });
  }

  let table;
  let alias = null;
  if (column instanceof Array) {
    [column, alias] = column;
  }
  if (typeof column === 'string') {
    [table, column] = resolveColumnName(column);
    columns.push({
      table,
      column,
      alias,
    });
  } else if (typeof column === 'object' && column.type === 'expr_list') {
    // ast
    const expr = column.value[0];
    columns.push({
      table,
      expr,
      alias,
    });
  }

  return columns;
}

function getJoinTableName(node) {
  const name = node.alias || node.name;
  if (name) {
    return name;
  } if (node.left) {
    return getJoinTableName(node.left);
  }

  return null;
}

function resolveJoinTable(table, isRight = false) {
  if (typeof table === 'string') {
    table = {
      name: table,
    };
  }
  if (table.left) {
    return resolveJoin(table, isRight);
  }

  const [db, name] = resolveTableName(table.name);
  const ast = {
    type: 'table_ref',
    db,
    table: name,
    as: table.alias || null,
  };

  return ast;
}

function resolveJoin(join, parentheses = false) {
  const left = resolveJoinTable(join.left);
  const right = resolveJoinTable(join.right, true);
  let joinon;
  if (join.on) {
    joinon = parse(join.on);
  } else {
    const [ltable, lcol = 'id'] = join.left.key ? resolveColumnName(join.left.key) : [];
    const [rtable, rcol = 'id'] = join.right.key ? resolveColumnName(join.right.key) : [];
    joinon = {
      type: 'binary_expr',
      operator: '=',
      left: {
        type: 'column_ref',
        table: ltable || getJoinTableName(join.left),
        column: lcol,
      },
      right: {
        type: 'column_ref',
        table: rtable || getJoinTableName(join.right),
        column: rcol,
      },
    };
  }
  return {
    type: 'table_join',
    operator: join.join || 'INNER JOIN',
    left,
    right,
    on: joinon,
    parentheses,
  };
}

function resolveWhereAndOr(op, where, parentheses = false) {
  const keys = Object.keys(where);
  if (keys.length === 1) {
    if (['$and', '$or'].includes(keys[0])) {
      return resolveWhereAndOr(keys[0], where[keys[0]], true);
    }
    return resolveWhereNode(keys[0], where[keys[0]]);
  }
  const first = keys[0];
  const firstNode = where[first];
  const restNodes = Object.assign({}, where);
  delete restNodes[first];
  return {
    type: 'binary_expr',
    operator: op === '$or' ? 'OR' : 'AND',
    left: ['$and', '$or'].includes(first) ? resolveWhereAndOr(first, firstNode) : resolveWhereNode(first, firstNode),
    right: resolveWhereAndOr(op, restNodes),
    parentheses,
  };
}

function resolveWhereNodeValuePair(key, op, value) {
  if (value === null) {
    return {
      type: 'binary_expr',
      operator: op,
      left: {
        type: 'column_ref',
        table: null,
        column: key,
      },
      right: {
        type: 'null',
        value: null,
      },
    };
  }

  return {
    type: 'binary_expr',
    operator: op,
    left: {
      type: 'column_ref',
      table: null,
      column: key,
    },
    right: {
      type: typeof value,
      value,
    },
  };
}

function resolveWhereNodeAnd(key, value) {
  const ops = Object.keys(value);
  if (ops.length === 1) {
    return resolveWhereNodeValuePair(key, ops[0], value[ops[0]]);
  }

  const first = ops[0];
  const firstValue = ops[first];
  const restNodes = Object.assign({}, value);
  delete restNodes[first];
  return {
    type: 'binary_expr',
    operator: 'AND',
    left: resolveWhereNodeValuePair(key, first, firstValue),
    right: resolveWhereNodeAnd(key, restNodes),
  };
}

function resolveWhereNode(key, value) {
  if (key === '$$') {
    return parse(value);
  }
  if (value instanceof Array) {
    return resolveWhereNodeAnd(key, {
      $in: value,
    });
  } if (value === null) {
    return resolveWhereNodeAnd(key, {
      $is: null,
    });
  } if (typeof value === 'object') {
    return resolveWhereNodeAnd(key, value, true);
  }

  return resolveWhereNodeAnd(key, {
    '=': value,
  });
}

module.exports = {
  columns(columns) {
    const astColumns = [];
    columns.forEach((item) => {
      const fields = resolveField(item);
      fields.forEach((field) => {
        const {
          table, expr, column, alias
        } = field;
        let astColumn;
        if (expr) {
          astColumn = {
            expr,
            as: alias,
          };
        } else {
          astColumn = {
            expr: {
              type: 'column_ref',
              table,
              column,
            },
            as: alias,
          };
        }
        astColumns.push(astColumn);
      });
    });

    return astColumns;
  },

  from(from) {
    return resolveJoinTable(from);
  },

  where(where) {
    return resolveWhereAndOr('$and', where);
  },

  orderby(orderby) {
    if (typeof orderby === 'string') {
      orderby = [orderby];
    }
    const orderbyAst = [];
    orderby.forEach((item) => {
      let table;
      let column = item;
      let order = 'ASC';
      if (typeof item === 'string') {
        if (item.startsWith('-')) {
          order = 'DESC';
          column = item.substring(1);
        }

        [table, column] = resolveColumnName(column);
      } else if (item instanceof Array) {
        [column, order] = item;
        [table, column] = resolveColumnName(column);
        order = order.toUpperCase();
      }

      orderbyAst.push({
        expr: {
          type: 'column_ref',
          table,
          column,
        },
        type: order,
      });
    });

    return orderbyAst;
  },

  having(having) {
    return resolveWhereAndOr('$and', having);
  },

  groupby(groupby) {
    if (typeof groupby === 'string') {
      groupby = [groupby];
    }
    const groupbyAst = [];
    groupby.forEach((item) => {
      const [table, column] = resolveColumnName(item);
      groupbyAst.push({
        type: 'column_ref',
        table,
        column,
      });
    });

    return groupbyAst;
  },

  limit(limit) {
    return {
      type: 'number',
      value: limit,
    };
  },

  skip(skip) {
    return {
      type: 'number',
      value: skip,
    };
  },

  table(table) {
    return table;
  },

  values(values) {
    const astColumns = [];
    const astValues = [];
    if (!(values instanceof Array)) {
      values = [values];
    }

    const first = values[0];
    astColumns.push(...Object.keys(first));
    values.forEach((row) => {
      const rowValues = [];
      astColumns.forEach((field) => {
        rowValues.push({
          type: typeof row[field],
          value: row[field],
        });
      });
      astValues.push({
        type: 'expr_list',
        value: rowValues,
      });
    });

    return {
      columns: astColumns,
      values: astValues,
    };
  },

  returns(returns) {

  },

  set(values) {
    const ast = [];
    Object.keys(values).forEach((key) => {
      ast.push({
        column: key,
        value: {
          type: typeof values[key],
          value: values[key],
        },
      });
    });

    return ast;
  },

  expr(expr) {
    return parse(expr);
  },

  ast2sql,
};
