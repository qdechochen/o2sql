const astTranslator = require('./ast-translator');
const ast2sql = require('../lib/ast2sql.js');
const parse = require('../lib/pegjs-parser').parse;

function copyOptions(target, source, keys) {
  keys.forEach(key => {
    if (key in source) {
      target[key](source[key]);
    }
  });
}

let onExecuteHandler = () => {
  throw new Error('on execute handler not defined');
};

function setOnExecuteHandler(cb) {
  onExecuteHandler = cb;
}

class Command {
  constructor(command) {
    this.___className = 'Command';
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
    return onExecuteHandler.call(this, this.toParams(), ...args);
  }
}

class Identifier extends Command {
  constructor(options) {
    super('identifier');
    const { name } = options;
    if (name) {
      this._name = name;
      this.ast = astTranslator.identifier(name);
    }
  }
}

class Func extends Command {
  constructor(options) {
    super('function');
    const { name, args } = options;
    if (name) {
      this.call(name, ...args);
    }
  }

  call(name, ...args) {
    this._name = name;
    this._args = args;

    this.ast = astTranslator.func(name, ...args);
    return this;
  }
}

class Select extends Command {
  constructor(options) {
    super('select');
    copyOptions(this, options, [
      'columns',
      'from',
      'where',
      'orderby',
      'having',
      'groupby',
      'limit',
      'skip',
    ]);
  }

  columns(val = ['*']) {
    this._columns = val;
    this.ast.columns = astTranslator.columns(this._columns);
    return this;
  }

  select(val) {
    return this.columns(val);
  }

  from(val) {
    if (typeof val === 'string') {
      val = {
        name: val,
      };
    }
    this._from = val;
    this.ast.from = astTranslator.from(this._from);
    this.ast.mainTable = astTranslator.findMainTable(this._from);
    return this;
  }

  join(table, on, main = false) {
    if (!this._from) {
      return this.from(table);
    }
    return this._join(table, 'INNER JOIN', on, main);
  }

  leftJoin(table, on, main = false) {
    return this._join(table, 'LEFT JOIN', on, main);
  }

  rightJoin(table, on, main = false) {
    return this._join(table, 'RIGHT JOIN', on, main);
  }

  _join(table, join, on, main = false) {
    if (typeof table === 'string') {
      table = {
        name: table,
      };
    }
    if (main) {
      table.main = main;
    }
    if (on instanceof Array) {
      this._from = {
        left: {
          ...this._from,
          key: on[0],
        },
        right: {
          ...table,
          key: on[1],
        },
        join,
      };
    } else {
      this._from = {
        left: {
          ...this._from,
        },
        right: {
          ...table,
        },
        on,
        join,
      };
    }
    this.ast.from = astTranslator.from(this._from);
    this.ast.mainTable = this.ast.mainTable || astTranslator.findMainTable(this._from);
    return this;
  }

  union(select) {
    if (!this._union) {
      this._union = [];
    }
    this._union.push(select);
    let lastSelect = this.ast;
    while (lastSelect._next) {
      lastSelect = lastSelect._next;
    }
    lastSelect._next = select.ast;
    return this;
  }

  tableSample(method, args = 1, seed) {
    if (!(args instanceof Array)) {
      args = [args];
    }
    this._tableSample = { method, args, seed };
    this.ast.tableSample = astTranslator.tableSample(this._tableSample);
    return this;
  }

  distinct(val = true) {
    this._distinct = val;
    this.ast.distinct = astTranslator.distinct(this._distinct);

    return this;
  }

  where(val) {
    if (typeof val === 'number' || typeof val === 'string') {
      val = {
        id: val,
      };
    } else if (!val || Object.keys(val).length === 0) {
      return this;
    }
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

  paginate(page = 1, pageSize = 10) {
    return this.limit(pageSize).skip(pageSize * (page - 1));
  }

  pagination(page = 1, pageSize = 10) {
    return this.paginate(page, pageSize);
  }
}

class Count extends Command {
  constructor(options) {
    super('count');
    this.isCount = true;
    copyOptions(this, { columns: ['*'], ...options }, ['columns', 'from', 'where', 'distinct']);
    return this;
  }
  
  columns(val = ['*']) {
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
    this.ast.mainTable = astTranslator.findMainTable(this._from);
    return this;
  }

  join(table, on, main = false) {
    if (!this._from) {
      return this.from(table);
    }
    return this._join(table, 'INNER JOIN', on, main);
  }

  leftJoin(table, on, main = false) {
    return this._join(table, 'LEFT JOIN', on, main);
  }

  rightJoin(table, on, main = false) {
    return this._join(table, 'RIGHT JOIN', on, main);
  }

  _join(table, join, on, main = false) {
    if (typeof table === 'string') {
      table = {
        name: table,
      };
    }
    if (main) {
      table.main = main;
    }
    if (on instanceof Array) {
      this._from = {
        left: {
          ...this._from,
          key: on[0],
        },
        right: {
          ...table,
          key: on[1],
        },
        join,
      };
    } else {
      this._from = {
        left: {
          ...this._from,
        },
        right: {
          ...table,
        },
        on,
        join,
      };
    }
    this.ast.from = astTranslator.from(this._from);
    this.ast.mainTable = this.ast.mainTable || astTranslator.findMainTable(this._from);
    return this;
  }

  distinct(val = true) {
    this._distinct = val;
    this.ast.distinct = astTranslator.distinct(this._distinct);

    return this;
  }

  where(val) {
    if (typeof val === 'number' || typeof val === 'string') {
      val = {
        id: val,
      };
    } else if (!val || Object.keys(val).length === 0) {
      return this;
    }
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
    if (typeof val === 'number' || typeof val === 'string') {
      val = {
        id: val,
      };
    } else if (!val || Object.keys(val).length === 0) {
      return this;
    }
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
    if (typeof val === 'number' || typeof val === 'string') {
      val = {
        id: val,
      };
    } else if (!val || Object.keys(val).length === 0) {
      return this;
    }
    this._where = val;
    this.ast.where = astTranslator.where(this._where);
    return this;
  }
}

const commands = {
  setOnExecuteHandler,
  Command,
  IDENTIFIER: Identifier,
  FUNCTION: Func,
  SELECT: Select,
  COUNT: Count,
  GET: Get,
  INSERT: Insert,
  UPDATE: Update,
  DELETE: Delete,
};

module.exports = commands;
