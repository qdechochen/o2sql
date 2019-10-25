const o2sql = require('../lib/o2sql');

let x = o2sql
  .select(['id'])
  .from('a')
  .where({
    a: {
      '>': 3,
      '<': 5,
      '<>': 4,
    },
    $1: [
      {
        b: {
          '>': 3,
          '<': 5,
          '<>': 4,
        },
      },
      {
        c: {
          '>': 3,
          '<': 5,
          '<>': 4,
        },
      },
    ],
  });

console.dir(x, { depth: 8 });
console.dir(x.toParams(), { depth: 8 });
