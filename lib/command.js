const astTranslator = require('./ast-translator');
const ast2sql = require('../lib/ast2sql.js');
const parse = require('../lib/pegjs-parser').parse;

function copyOptions(target, source, keys) {
  keys.forEach((key) => {
    target['_' + key] = source[key] || null;
  });
}

class Command {
  constructor(command) {
    this.command = command;
    this.onExecuteHandler = () => {
      throw new Error('on execute handler not defined');
    };
    this.ast = {
      type: command,
    };
  }

  toParams() {
    return ast2sql(this.ast);
  }

  async execute(...args) {
    return this.onExecuteHandler(this.toParams(), ...args);
  }
}

class Select extends Command {
  constructor(options) {
    super('select');
    copyOptions(this, options, ['columns', 'from', 'where', 'orderby', 'having', 'groupby', 'limit', 'skip']);
  }

  columns(val) {
    this._columns = val;
    this.ast.columns = astTranslator.columns(this._columns);
    return this;
  }

  select(val) {
    return this.columns(val);
  }

  from(val) {
    this._from = val;
    this.ast.from = astTranslator.from(this._from);
    return this;
  }

  where(val) {
    this._where = val;
    this.ast.where = astTranslator.where(this._where);
    return this;
  }

  orderby(val) {
    this._orderby = val;
    this.ast.orderby = astTranslator.orderby(this._orderby);
    return this;
  }

  having(val) {
    this._having = val;
    this.ast.having = astTranslator.having(this._having);
    return this;
  }

  groupby(val) {
    this._groupby = val;
    this.ast.groupby = astTranslator.groupby(this._groupby);
    return this;
  }

  limit(val) {
    this._limit = val;
    this.ast.limit = astTranslator.limit(this._limit);
    return this;
  }

  skip(val) {
    this._skip = val;
    this.ast.skip = astTranslator.skip(this._skip);
    return this;
  }
}

class Count extends Command {
  constructor(options) {
    super('select');
    this.isCount = true;
    copyOptions(this, options, ['columns', 'from', 'where']);
    this._columns = [[parse('count(*)'), 'count']];
    this.ast.columns = astTranslator.columns(this._columns);
    return this;
  }

  from(val) {
    this._from = val;
    this.ast.from = astTranslator.from(this._from);
    return this;
  }

  where(val) {
    this._where = val;
    this.ast.where = astTranslator.where(this._where);
    return this;
  }
}

class Get extends Select {
  constructor(options) {
    super(options);
    this.isGet = true;
    this.limit = 1;
  }
}

class Insert extends Command {
  constructor(options) {
    super('insert');
    copyOptions(this, options, ['table', 'values', 'return']);
  }

  into(val) {
    this._table = val;
    this.ast.table = astTranslator.table(this._table);
    return this;
  }

  values(val) {
    this._values = val;
    Object.assign(this.ast, astTranslator.values(this._values));
    return this;
  }

  returning(val) {
    this._returning = val;
    this.ast.returning = astTranslator.columns(this._returning);
    return this;
  }
}

class Update extends Command {
  constructor(options) {
    super('update');
    copyOptions(this, options, ['table', 'set', 'where']);
  }

  table(val) {
    this._table = val;
    this.ast.table = astTranslator.table(this._table);
    return this;
  }

  set(val) {
    this._set = val;
    this.ast.set = astTranslator.set(this._set);
    return this;
  }

  where(val) {
    this._where = val;
    this.ast.where = astTranslator.where(this._where);
    return this;
  }

  returning(val) {
    this._returning = val;
    this.ast.returning = astTranslator.columns(this._returning);
    return this;
  }
}

class Delete extends Command {
  constructor(options) {
    super('delete');
    copyOptions(this, options, ['table', 'where']);
  }

  from(val) {
    this._table = val;
    this.ast.table = astTranslator.table(this._table);
    return this;
  }

  where(val) {
    this._where = val;
    this.ast.where = astTranslator.where(this._where);
    return this;
  }
}

const commands = {
  Command,
  SELECT: Select,
  COUNT: Count,
  GET: Get,
  INSERT: Insert,
  UPDATE: Update,
  DELETE: Delete,
};

module.exports = commands;
