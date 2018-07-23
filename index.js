const { Command } = require('./lib/command');
const Osql = require('./lib/osql');
const parse = require('./lib/pegjs-parser').parse;

const osql = options => Osql(options);
osql.parse = parse;
osql.setExecuteHandler = (cb) => {
  Command.prototype.onExecuteHandler = cb;
};

module.exports = osql;
