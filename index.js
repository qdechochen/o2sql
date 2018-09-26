const { setOnExecuteHandler } = require('./lib/command');
const osql = require('./lib/osql');
const parse = require('./lib/pegjs-parser').parse;

osql.parse = parse;
osql.setOnExecuteHandler = cb => setOnExecuteHandler(cb);

module.exports = osql;
