const { Command } = require('./command');
const Osql = require('./lib/osql');
const parse = require('./lib/pegjs-parser').parse;

const osql = options => Osql(options);
osql.parse = parse;
osql.setExecuteHandler = (cb) => {
  Command.onExecute(cb);
};

module.exports = osql;
