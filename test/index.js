const osql = require('../index');
const ast2sql = require('../lib/ast2sql.js');

/*
const o2s1 = osql('select');
o2s1.from({
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
}, 'id', 'name', ['class', 'className'], [osql.parse('convert(a, 101)'), 'dt']])
  .where({
    a: 1,
    b: 2,
    e: 'abcd',
    $or: { c: 3, d: 4 }
  })
  .groupby(['a.id', 'b.id'])
  .orderby(['a.id', '-b.id', ['c.id', 'desc']])
  .limit(4)
  .skip(8);

/*
const o2s2 = osql('insert').into('users').values([{
  id: 1,
  name: 'Echo Chen',
}, {
  id: 12,
  name: 'Echo Chen2',
}]).returning(['id', 'name']);

const ids = [1, 2, 3];
const o2s2 = osql('update').table('users').set({
  id: 1,
  name: 'Echo Chen',
}).where({
  $$: `id=ANY(${ids})`,
});

const o2s = osql('select').from('user').where({
  id: null,
  name: {
    'IS NOT': null,
  },
  title: {
    like: '%abc',
  },
  age: [1, 2, 3],
});

// const o2s = o2sql('delete').from('user').where({ id: 2 });
// console.dir(o2s);
// console.log(o2s.toParams());
/*
console.log(JSON.stringify(o2s.ast, 2, 2));
console.log(o2s.toParams());
console.dir(JSON.stringify(osql.parse('select did from usder where id in (select id from classs)'), 2, 2));

*/
console.log('==========');
const o2s3 = osql('select').from('user').where({
  id: 2,
  age: {
    IN: osql('select').from('ua').columns(['age']).where({
      tt: 3,
    }).ast,
  },
});
const a = 3;
const b = 3;
console.log(JSON.stringify(o2s3.ast, 2, 2));
console.log(o2s3.toParams());
