const Osql = require('./lib/osql');
const parse = require('./lib/pegjs-parser').parse;

const o2sql = options => Osql(options);
o2sql.parse = parse;


module.exports = o2sql;
