const { setOnExecuteHandler } = require('./lib/command');
const Osql = require('./lib/osql');
const parse = require('./lib/pegjs-parser').parse;

const osql = options => Osql(options);
osql.parse = parse;
osql.setOnExecuteHandler = cb => setOnExecuteHandler(cb);

module.exports = osql;
