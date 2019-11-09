const o2sql = require('../lib/o2sql');

let x = o2sql
  .delete('a')
  .where(2)
  .returning(['x', 'y']);

console.dir(x, { depth: 8 });
console.dir(x.toParams(), { depth: 8 });
