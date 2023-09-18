const ast = require('./ast');
const command = require('./command');
function createO2sql(db) {
  if (!['pg', 'mysql'].includes(db)) {
    throw new Error('o2sql: ' + db + ' not supported');
  }

  const { FunctionAst, IdentifierAst, ValueAst, ExprAst, TableAst } = ast[db];

  const { where, Select, Get, Count, Update, Delete, Insert } = command[db];

  class O2sql {
    static get command() {
      return { Select, Get, Count, Update, Delete, Insert }; // deprecated. will be removed in v4
    }
    f(name, ...args) {
      return new FunctionAst(name, ...args);
    }
    function() {
      return this.f(...arguments);
    }
    i(name) {
      return new IdentifierAst(name);
    }
    identifier() {
      return this.i(...arguments);
    }
    v(name) {
      return new ValueAst(name);
    }
    value() {
      return this.v(...arguments);
    }
    e(left, op, right) {
      return new ExprAst(left, op, right);
    }
    expr() {
      return this.e(...arguments);
    }
    t(name) {
      return new TableAst(name);
    }
    table() {
      return this.t(...arguments);
    }
    where() {
      return where(...arguments);
    }
    select(columns = ['*']) {
      const command = new Select();
      command.columns(columns);
      return command;
    }
    get(columns = ['*']) {
      const command = new Get();
      command.columns(columns);
      return command;
    }
    count(opt) {
      const command = new Count();
      command[opt instanceof Array ? 'columns' : 'from'](opt);
      return command;
    }
    update(table) {
      const command = new Update();
      command.table(table);
      return command;
    }
    delete(table) {
      const command = new Delete();
      command.table(table);
      return command;
    }
    insert(values) {
      const command = new Insert();
      command.values(values);
      return command;
    }
    insertInto(table) {
      const command = new Insert();
      command.table(table);
      return command;
    }
  }

  return O2sql;
}
const O2sqlPg = createO2sql('pg');
const O2sqlMySql = createO2sql('mysql');
O2sqlPg.pg = O2sqlPg;
O2sqlPg.mysql = O2sqlMySql;
module.exports = O2sqlPg;
