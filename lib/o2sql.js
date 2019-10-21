const { FunctionAst, IdentifierAst, ValueAst } = require('./ast');
const { Select, Get, Count, Update, Delete, Insert } = require('./command');

const o2sql = {
  func: (name, ...args) => {
    return new FunctionAst(name, ...args);
  },
  identifier: name => {
    return new IdentifierAst(name);
  },
  value: name => {
    return new ValueAst(name);
  },
  select: (columns = ['*']) => {
    const command = new Select();
    command.columns(columns);
    return command;
  },
  get: (columns = ['*']) => {
    const command = new Get();
    command.columns(columns);
    return command;
  },
  count: (columns = ['*']) => {
    const command = new Count();
    command.columns(columns);
    return command;
  },
  update: table => {
    const command = new Update();
    command.table(table);
    return command;
  },
  delete: table => {
    const command = new Delete();
    command.table(table);
    return command;
  },
  insert: values => {
    const command = new Insert();
    command.values(values);
    return command;
  },
  insertInto: table => {
    const command = new Insert();
    command.table(table);
    return command;
  },
};

module.exports = o2sql;
