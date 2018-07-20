const Osql = require('./lib/osql');
const parse = require('./lib/pegjs-parser').parse;

const osql = options => Osql(options);
osql.parse = parse;

module.exports = osql;
