const o2sql = require('../lib/o2sql');

let x = o2sql.insert({ a: 1, b: 2 }).into('user');
console.dir(x, { depth: 8 });
console.dir(x.toParams(), { depth: 8 });
