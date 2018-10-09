const { setOnExecuteHandler } = require('./lib/command');
const o2sql = require('./lib/o2sql');
const parse = require('./lib/pegjs-parser').parse;

o2sql.parse = parse;
o2sql.setOnExecuteHandler = cb => setOnExecuteHandler(cb);

module.exports = o2sql;
