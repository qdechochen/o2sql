const o2sql = require('../lib/o2sql');

let x = o2sql
  .update('user')
  .set({
    name: 'Echo',
    age: 34,
    count: o2sql.expr(o2sql.i('count'), '+', 1),
    likes: o2sql.count('ul').where({
      tt: 3,
    }),
  })
  .where({
    id: 1,
  });

console.dir(x, { depth: 8 });
console.dir(x.toParams(), { depth: 8 });
