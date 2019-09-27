const o2sql = require('../index');

const q = o2sql.count({
  name: o2sql
    .select([
      [o2sql.f('to_char', o2sql.i('createdAt'), 'yyyy-mm-dd'), 'd'],
      'type',
      'userId',
      'targetId',
    ])
    .from('viewLog')
    .distinct()
    .where({
      createdAt: {
        BETWEEN: [111, 222],
      },
    }),
});
console.dir(q.ast);
console.dir(q.toParams());
