const o2sql = require('../index');

const o = o2sql('select').from({
  left: {
    left: {
      name: 'user',
      alias: 'U',
      key: 'classId',
    },
    right: {
      name: 'class',
      alias: 'C',
      key: 'id',
      main: true,
    },
    key: 'U.gradeId',
  },
  right: {
    name: 'grade',
    alias: 'G',
  },
}).columns([{
  table: 'U', prefix: 'user', separator: '_', fields: ['id', 'name']
}, 'id', 'name', ['class', 'className'], [o2sql.parse('convert(a, 101)'), 'dt']])
  .where({
    'U.a': 1,
    b: 2,
    e: 'abcd',
    $or: { c: 3, d: 4 }
  })
  .groupby(['a.id', 'b.id'])
  .orderby(['a.id', '-b.id', ['c.id', 'desc']])
  .limit(4)
  .skip(8);

console.log(JSON.stringify(o.ast, 2, 2));
console.dir(o.toParams());
