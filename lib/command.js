const ast = require('./ast');

function createCommands(db) {
  if (!['pg', 'mysql'].includes(db)) {
    throw new Error('o2sql: ' + db + ' not supported');
  }

  const {
    // mergeParams,
    Ast,
    ValueAst,
    ExprAst,
    IdentifierAst,
    ColumnRefAst,
    ColumnAst,
    OrderbyColumnAst,
    TableRefAst,
    TableAst,
    resolveValue,
    parseExprObject,
  } = ast[db];

  function capFirstLetter(s) {
    return s[0].toUpperCase() + s.substring(1);
  }
  function getAliasName(prefix, separator, alias) {
    if (prefix) {
      let name = prefix;
      if (separator) {
        name += separator + alias;
      } else {
        name += capFirstLetter(alias);
      }
      return name;
    }
    return alias;
  }

  function where(...args) {
    let where = args.length === 0 ? undefined : new ExprAst(...args);
    const proxy = new Proxy(
      {},
      {
        get: (target, prop) => {
          if (prop === '___toRaw') {
            return where;
          } else if (prop === 'isWhereProxy') {
            return true;
          }
          return (...args) => {
            if (where) {
              where = where[prop](...args);
            } else {
              where = new ExprAst(...args);
            }
            return proxy;
          };
        },
        set: (target, prop, value) => {
          console.log(target, prop, value);
          target[prop] = value;
        },
      }
    );
    return proxy;
  }

  class Command extends Ast {
    async execute() {
      throw new Error(
        '[o2sql] execute handler is not supported directly since v4. Please use o2sql-pg to integrate with pg, o2sql-mysql to integrate with mysql, or use your own logic.'
      );
    }
  }

  class BaseCommand extends Command {
    constructor(type) {
      super(type);
      this.data = {
        from: null,
        defaultTable: null,
        where: null,
      };
    }

    from(table) {
      this.data.from = new TableAst(table);

      return this;
    }

    join(table, on) {
      return this.innerJoin(table, on);
    }

    innerJoin(table, on) {
      this.data.from.innerJoin(table, on);

      return this;
    }

    leftJoin(table, on) {
      this.data.from.leftJoin(table, on);

      return this;
    }

    rightJoin(table, on) {
      this.data.from.rightJoin(table, on);

      return this;
    }

    fullJoin(table, on) {
      this.data.from.fullJoin(table, on);

      return this;
    }

    crossJoin(table) {
      this.data.from.crossJoin(table);

      return this;
    }

    default(table) {
      this.data.defaultTable = table;

      return this;
    }

    where(cond) {
      if (cond.isWhereProxy) {
        this.data.where = cond.___toRaw;
      } else {
        if (['number', 'string'].includes(typeof cond)) {
          cond = {
            id: cond,
          };
        } else if (typeof cond !== 'object') {
          throw new Error('[o2sql] invalid where');
        }
        this.data.where = parseExprObject(cond);
      }
      return this;
    }
  }

  class Select extends BaseCommand {
    constructor(type = 'select') {
      super(type);
      Object.assign(this.data, {
        columns: null,
        columnGroups: null,
        distinct: null,
        orderby: null,
        having: null,
        groupby: null,
        limit: null,
        skip: null,
        union: null,
        isCount: false,
      });
    }

    columns(columns = ['*']) {
      if (!(columns instanceof Array)) {
        throw new Error('[o2sql] invalid columns settings');
      }
      this.data.columns = [];
      this.data.columnGroups = [];
      columns.forEach(t => {
        if (typeof t === 'object' && t.table) {
          const group = t.group && {
            name: t.prefix,
            columns: [],
          };
          (t.fields || t.columns).forEach(p => {
            if (p instanceof Ast) {
              throw new Error(
                '[o2sql] only plain text field name supported in nested fields'
              );
            }
            let orgAlias;
            if (typeof p === 'string') {
              orgAlias = p;
              p = {
                column: {
                  db: t.db,
                  schema: t.schema,
                  table: t.table,
                  column: p,
                },
                alias: getAliasName(t.prefix ?? t.table, t.separator, orgAlias),
              };
            } else if (p instanceof Array) {
              orgAlias = p[1] || p[0];
              p[1] = getAliasName(t.prefix ?? t.table, t.separator, orgAlias);
              p.alias = getAliasName(
                t.prefix ?? t.table,
                t.separator,
                orgAlias
              );
            } else if (typeof p === 'object') {
              orgAlias = p.alias || p.field;
              p.alias = getAliasName(
                t.prefix ?? t.table,
                t.separator,
                orgAlias
              );
            }
            if (group) {
              group.columns.push([p.alias, orgAlias]);
            }
            this.data.columns.push(new ColumnAst(p));
          });
          if (group) {
            this.data.columnGroups.push(group);
          }
        } else {
          this.data.columns.push(new ColumnAst(t));
        }
      });

      return this;
    }

    select(...args) {
      return this.columns(...args);
    }

    distinct(distinct = []) {
      const fields = typeof distinct === 'string' ? [distinct] : distinct;
      if (!(fields instanceof Array)) {
        throw new Error('[o2sql] invalid distinct settings');
      }
      this.data.distinct = [];
      fields.forEach(t => {
        this.data.distinct.push(new ColumnAst(t));
      });

      return this;
    }

    having(cond) {
      if (['number', 'string'].includes(typeof cond)) {
        cond = {
          id: cond,
        };
      } else if (typeof cond !== 'object') {
        throw new Error('[o2sql] invalid having');
      }
      this.data.having = parseExprObject(cond);

      return this;
    }

    groupby(groupby) {
      this.data.groupby = [];
      if (typeof groupby === 'string') {
        groupby = [groupby];
      }
      groupby.forEach(t => {
        this.data.groupby.push(t instanceof Ast ? t : new IdentifierAst(t));
      });

      return this;
    }

    orderby(orderby) {
      this.data.orderby = [];
      if (typeof orderby === 'string') {
        orderby = orderby.split(',');
      }
      orderby.forEach(t => {
        this.data.orderby.push(new OrderbyColumnAst(t));
      });

      return this;
    }

    limit(limit) {
      if (limit > 0) {
        this.data.limit = limit instanceof Ast ? limit : new ValueAst(limit);
      }
      return this;
    }

    skip(skip) {
      this.data.skip = skip instanceof Ast ? skip : new ValueAst(skip);

      return this;
    }

    offset(offset) {
      return this.skip(offset);
    }

    paginate(page = 1, pageSize = 10) {
      return this.limit(pageSize).skip(pageSize * (page - 1));
    }

    union(select) {
      this.data.union = select;

      return this;
    }

    toParams(params, { parentheses } = {}) {
      if (!params) {
        params = {
          sql: '',
          values: [],
        };
        parentheses = false;
      } else if (parentheses === undefined) {
        parentheses = true;
      }
      if (parentheses) {
        params.sql += '(';
      }

      let aliases = [];
      if (this.data.defaultTable && this.data.columns) {
        this.data.columns.forEach(t => {
          if (t.alias) {
            aliases.push(t.alias);
          }
        });
      }

      const getDefaultTable = name => {
        return aliases.includes(name) ? '' : this.data.defaultTable;
      };

      params.sql += 'SELECT ';
      if (this.data.isCount) {
        params.sql += 'COUNT(';
      }
      if (this.data.distinct) {
        if (this.data.distinct.length === 0) {
          params.sql += 'DISTINCT ';
        } else {
          params.sql += 'DISTINCT (';
          this.data.distinct.forEach((t, index) => {
            t.toParams(params, {
              separator: index === 0 ? '' : ',',
              getDefaultTable,
            });
          });
          params.sql += ') ';
        }
      }

      if (this.data.columns) {
        this.data.columns.forEach((t, index) => {
          t.toParams(params, {
            separator: index ? ',' : '',
            getDefaultTable,
          });
        });
      } else if (!this.data.distinct) {
        params.sql += '*';
      }

      if (this.data.isCount) {
        if (this._db === 'pg') {
          params.sql += ')::INTEGER AS count';
        } else {
          params.sql += ') AS count';
        }
      }

      if (this.data.from) {
        params.sql += ' FROM ';
        this.data.from.toParams(params, { getDefaultTable });

        if (this.data.where) {
          params.sql += ' WHERE ';
          this.data.where.toParams(params, { getDefaultTable });
        }

        if (this.data.having) {
          params.sql += ' HAVING ';
          this.data.having.toParams(params, { getDefaultTable });
        }

        if (this.data.groupby) {
          params.sql += ' GROUP BY ';
          this.data.groupby.forEach((t, index) => {
            t.toParams(params, {
              separator: index === 0 ? '' : ',',
              getDefaultTable,
            });
          });
        }

        if (this.data.orderby) {
          params.sql += ' ORDER BY ';
          this.data.orderby.forEach((t, index) => {
            t.toParams(params, {
              separator: index === 0 ? '' : ',',
              getDefaultTable,
            });
          });
        }

        if (this.data.limit) {
          params.sql += ' LIMIT ';
          this.data.limit.toParams(params);
        }

        if (this.data.skip) {
          params.sql += ' OFFSET ';
          this.data.skip.toParams(params);
        }

        if (this.data.union) {
          params.sql += ' UNION ALL ';
          this.data.union.toParams(params, {
            parentheses: false,
          });
        }
      }
      if (parentheses) {
        params.sql += ')';
      }

      return params;
    }
  }

  class Get extends Select {
    constructor() {
      super('get');
      this.data.limit = new ValueAst(1);
    }

    limit() {
      throw new Error('[o2sql] limit not supported in get command');
    }

    union() {
      throw new Error('[o2sql] union not supported in get command');
    }
  }

  class Count extends Select {
    constructor() {
      super('count');
      this.data.isCount = true;
    }

    get isCount() {
      return this.data.isCount;
    }

    limit() {
      throw new Error('[o2sql] limit not supported in get command');
    }

    union() {
      throw new Error('[o2sql] union not supported in get command');
    }
  }

  class Insert extends Command {
    constructor() {
      super('insert');
      this.data = {
        table: null,
        fields: null,
        values: null,
        returning: null,
      };
    }

    table(table) {
      this.data.table = new TableRefAst(table);

      return this;
    }

    into(table) {
      return this.table(table);
    }

    values(values) {
      this.data.values = [];
      const vals = values instanceof Array ? values : [values];
      let fields = [];
      for (let i = 0; i < vals.length && i < 50; i++) {
        fields.push(...Object.keys(vals[i]));
      }
      fields = [...new Set(fields)];
      this.data.fields = fields.map(t => new IdentifierAst(t));

      vals.forEach(t => {
        const row = [];
        fields.forEach(p => {
          const value = p in t ? t[p] : null;
          row.push(
            resolveValue(value instanceof Ast ? value : new ValueAst(value))
          );
        });
        this.data.values.push(row);
      });

      return this;
    }

    returning(columns = ['*']) {
      if (!(columns instanceof Array)) {
        throw new Error('[o2sql] invalid columns settings');
      }
      this.data.returning = [];
      columns.forEach(t => {
        this.data.returning.push(new ColumnAst(t));
      });

      return this;
    }

    toParams() {
      const params = {
        sql: '',
        values: [],
      };

      params.sql += 'INSERT INTO ';
      this.data.table.toParams(params);

      if (!this.data.values) {
        throw new Error('[o2sql] values not set in insert');
      }
      params.sql += '(';
      this.data.fields.forEach((t, index) => {
        if (index > 0) {
          params.sql += ',';
        }
        t.toParams(params);
      });
      params.sql += ')';

      params.sql += ' VALUES ';
      this.data.values.forEach((t, index) => {
        if (index > 0) {
          params.sql += ',';
        }
        params.sql += '(';

        t.forEach((p, i) => {
          if (i > 0) {
            params.sql += ',';
          }
          p.toParams(params);
        });
        params.sql += ')';
      });

      if (this._db === 'pg') {
        if (this.data.returning) {
          params.sql += ' RETURNING';
          this.data.returning.forEach((t, index) => {
            params.sql += index === 0 ? ' ' : ',';
            t.toParams(params);
          });
        }
      }
      return params;
    }
  }

  class Update extends BaseCommand {
    constructor() {
      super('update');
      Object.assign(this.data, {
        values: [],
        returning: null,
      });
    }

    table(table) {
      return this.from(table);
    }

    set(values) {
      Object.keys(values).forEach(t => {
        this.data.values.push({
          field: new ColumnRefAst(t),
          value: values[t] instanceof Ast ? values[t] : new ValueAst(values[t]),
        });
      });

      return this;
    }

    returning(columns = ['*']) {
      if (!(columns instanceof Array)) {
        throw new Error('[o2sql] invalid columns settings');
      }
      this.data.returning = [];
      columns.forEach(t => {
        this.data.returning.push(new ColumnAst(t));
      });

      return this;
    }

    toParams() {
      const params = {
        sql: '',
        values: [],
      };

      params.sql += 'UPDATE ';
      this.data.from.toParams(params);

      if (!this.data.values) {
        throw new Error('[o2sql] values not set in update');
      }

      params.sql += ' SET';
      this.data.values.forEach((t, index) => {
        params.sql += index ? ',' : ' ';
        t.field.toParams(params);
        params.sql += '=';
        t.value.toParams(params);
      });

      if (this.data.where) {
        params.sql += ' WHERE ';
        this.data.where.toParams(params);
      }

      if (this._db === 'pg') {
        if (this.data.returning) {
          params.sql += ' RETURNING';
          this.data.returning.forEach((t, index) => {
            params.sql += index === 0 ? ' ' : ',';
            t.toParams(params);
          });
        }
      }
      return params;
    }
  }

  class Delete extends BaseCommand {
    constructor() {
      super('delete');
      Object.assign(this.data, {
        returning: null,
      });
    }

    table(table) {
      return this.from(table);
    }

    returning(columns = ['*']) {
      if (!(columns instanceof Array)) {
        throw new Error('[o2sql] invalid columns settings');
      }
      this.data.returning = [];
      columns.forEach(t => {
        this.data.returning.push(new ColumnAst(t));
      });

      return this;
    }

    toParams() {
      const params = {
        sql: '',
        values: [],
      };

      params.sql += 'DELETE FROM ';
      this.data.from.toParams(params);

      if (this.data.where) {
        params.sql += ' WHERE ';
        this.data.where.toParams(params);
      }
      if (this.data.returning) {
        params.sql += ' RETURNING';
        this.data.returning.forEach((t, index) => {
          params.sql += index === 0 ? ' ' : ',';
          t.toParams(params);
        });
      }

      return params;
    }
  }

  return {
    where,
    Select,
    Get,
    Count,
    Update,
    Delete,
    Insert,
  };
}
module.exports = {
  pg: createCommands('pg'),
  mysql: createCommands('mysql'),
};
