const o2sql = require('../index');
const ast2sql = require('../lib/ast2sql.js');
/*
const o2s = o2sql('select');
o2s.from({
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
    },
    key: 'U.gradeId',
  },
  right: {
    name: 'grade',
    alias: 'G',
  },
}).columns([{
  table: 'U', prefix: 'user', separator: '_', fields: ['id', 'name']
}, 'id', 'name', ['class', 'className'], [o2sql.parse('convert(a, 101)'), 'dt']]).where({
  a: 1,
  b: 2,
  e: 'abcd',
  $or: { c: 3, d: 4 }
}).groupby(['a.id', 'b.id'])
  .orderby(['a.id', '-b.id', ['c.id', 'desc']])
  .limit(4)
  .skip(8);
*/

const o2s = o2sql('insert').into('users').values([{
  id: 1,
  name: 'Echo Chen',
}, {
  id: 12,
  name: 'Echo Chen2',
}]).returning(['id', 'name']);

// const o2s = o2sql('delete').from('user').where({ id: 2 });
console.dir(o2s);
console.log(JSON.stringify(o2s.ast, 2, 2));
console.log(o2s.toParams());
