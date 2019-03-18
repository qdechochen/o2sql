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
        alias: prefix ? (prefix + (separator ? (separator + subColumn.alias) : capFirstLetter(subColumn.alias))) : subColumn.alias,
      });
    });
  }

  let table;
  let alias = null;
  let castas = null;
  if (column instanceof Array) {
    [column, alias, castas] = column;
  }
  if (typeof column === 'string') {
    [table, column] = resolveColumnName(column);
    columns.push({
      table,
      column,
      alias,
      castas,
    });
  } else if (typeof column === 'object') {
    if (column.ast) {
      column = column.ast;
    }
    if (column.type === 'expr_list') {
      // ast
      const expr = column.value[0];

      columns.push({
        table,
        expr,
        alias,
        castas,
      });
    } else if (column.type === 'select') {
      columns.push({
        table: null,
        column,
        alias,
        castas,
      });
    }
  }

  return columns;
}

function getJoinTableName(node) {
  const table = node.as || node.table;
  if (table) {
    return table;
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
        table: ltable || getJoinTableName(left),
        column: lcol,
      },
      right: {
        type: 'column_ref',
        table: rtable || getJoinTableName(right),
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

function findMainTable(join) {
  return _find(join);
  function _find(t) {
    if (typeof t !== 'object') {
      return null;
    }
    if (t.main) {
      return t.alias || t.name;
    }
    return _find(t.left) || _find(t.right);
  }
}

function resolveTableSample({ method, args, seed }) {
}

function resolveWhereAndOr(op, where, parentheses = false) {
  const keys = Object.keys(where);
  if (keys.length === 0) {
    return null;
  }
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
    left: ['$and', '$or'].includes(first) ? resolveWhereAndOr(first, firstNode, true) : resolveWhereNode(first, firstNode),
    right: resolveWhereAndOr(op, restNodes),
    parentheses,
  };
}

function resolveWhereNodeValuePair(key, op, value) {
  let left;
  if (typeof key === 'object' && key.type) {
    left = key;
  } else if (typeof key === 'string') {
    const [table, column] = resolveColumnName(key);
    left = {
      type: 'column_ref',
      table,
      column,
    };
  } else {
    throw new Error('o2sql: key error');
  }

  let right;

  if (value && value.___className === 'Command') {
    value = value.ast;
  }
  if (value === null) {
    right = {
      type: 'null',
      value: null,
    };
  } else if (value instanceof Array) {
    right = {
      type: 'array',
      value,
    };
  } else if (typeof value === 'object' && value.type) {
    right = value;
  } else {
    right = {
      type: typeof value,
      value,
    };
  }

  return {
    type: 'binary_expr',
    operator: op,
    left,
    right,
  };
}

function resolveWhereNodeAnd(key, value) {
  const ops = Object.keys(value);
  if (ops.length === 1) {
    return resolveWhereNodeValuePair(key, ops[0], value[ops[0]]);
  }

  const first = ops[0];
  const firstValue = value[first];
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
  if (key.startsWith('$$')) {
    if (typeof value === 'string') {
      return parse(value);
    }
    return resolveWhereNodeValuePair(value.left, value.op, value.right);
  }

  if (value instanceof Array) {
    return resolveWhereNodeAnd(key, {
      IN: value,
    });
  }
  if (value === null) {
    return resolveWhereNodeAnd(key, {
      IS: null,
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
          table, expr, column, alias, castas
        } = field;
        let astColumn;
        if (expr) {
          astColumn = {
            expr,
            castas,
            as: alias,
          };
        } else {
          astColumn = {
            expr: {
              type: 'column_ref',
              table,
              column,
            },
            castas,
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
  findMainTable(from) {
    return findMainTable(from);
  },

  tableSample({ method, args, seed }) {
    return resolveTableSample({ method, args, seed });
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

  distinct(distinct) {
    const distinctAst = [];
    if (typeof distinct === 'string') {
      distinct = [distinct];
    }
    if (distinct instanceof Array && distinct.length > 0) {
      distinct.forEach((item) => {
        const [table, column] = resolveColumnName(item);
        distinctAst.push({
          type: 'column_ref',
          table,
          column,
        });
      });
    }

    return distinctAst;
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
        let val = row[field];
        if (val && val.___className === 'Command') {
          val = val.ast;
        }
        if (val && typeof val === 'object' && ['expr_list', 'select'].includes(val.type)) {
          rowValues.push(val);
        } else {
          rowValues.push({
            type: typeof val,
            value: val,
          });
        }
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
      let val = values[key];
      if (val && val.___className === 'Command') {
        val = val.ast;
      }
      if (val && typeof val === 'object' && ['expr_list', 'select'].includes(val.type)) {
        ast.push({
          column: key,
          value: val,
        });
      } else {
        ast.push({
          column: key,
          value: {
            type: typeof val,
            value: val,
          },
        });
      }
    });

    return ast;
  },

  expr(expr) {
    return parse(expr);
  },

  ast2sql,
};
