const {
  FunctionAst,
  IdentifierAst,
  ValueAst,
  ExprAst,
  TableAst,
} = require('./ast');
const {
  Select,
  Get,
  Count,
  Update,
  Delete,
  Insert,
  setOnExecuteHandler,
} = require('./command');

const o2sql = {
  function: (name, ...args) => {
    return new FunctionAst(name, ...args);
  },
  f: (name, ...args) => {
    return new FunctionAst(name, ...args);
  },
  identifier: name => {
    return new IdentifierAst(name);
  },
  i: name => {
    return new IdentifierAst(name);
  },
  value: name => {
    return new ValueAst(name);
  },
  v: name => {
    return new ValueAst(name);
  },
  expr: (left, op, right) => {
    return new ExprAst(left, op, right);
  },
  e: (left, op, right) => {
    return new ExprAst(left, op, right);
  },
  table: name => {
    return new TableAst(name);
  },
  t: name => {
    return new TableAst(name);
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
  count: opt => {
    const command = new Count();
    command[opt instanceof Array ? 'columns' : 'from'](opt);
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
  setOnExecuteHandler,
  command: { Select, Get, Count, Update, Delete, Insert },
};

module.exports = o2sql;
