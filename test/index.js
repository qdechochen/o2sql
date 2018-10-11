const o2sql = require('../index');
const ast2sql = require('../lib/ast2sql.js');

/*
const o2s1 = o2sql('select');
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
}, 'id', 'name', ['class', 'className'], [o2sql.parse('convert(a, 101)'), 'dt']])
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
const o2s2 = o2sql('insert').into('users').values([{
  id: 1,
  name: 'Echo Chen',
}, {
  id: 12,
  name: 'Echo Chen2',
}]).returning(['id', 'name']);

const ids = [1, 2, 3];
const o2s2 = o2sql('update').table('users').set({
  id: 1,
  name: 'Echo Chen',
}).where({
  $$: `id=ANY(${ids})`,
});

const o2s = o2sql('select').from('user').where({
  id: null,
  name: {
    'IS NOT': null,
  },
  title: {
    like: '%abc',
  },
  age: [1, 2, 3],
});
*/
const o2s = o2sql('delete').from('user').where({ id: 2 });
console.dir(o2s);
console.log(o2s.toParams());

console.log(JSON.stringify(o2s.ast, 2, 2));
console.log(o2s.toParams());
console.dir(JSON.stringify(o2sql.parse('select did from usder where id in (select id from classs)'), 2, 2));


console.log('==========');
const o2s3 = o2sql.select(['a', 'b']).from('user').where({
  id: 2,
  age: {
    IN: o2sql('select').from('ua').columns(['age']).where({
      tt: 3,
    }).ast,
  },
  $$: 'now() - sentAt <= \'10 minutes\'',
});
const a = 3;
const b = 3;
console.log(JSON.stringify(o2s3.ast, 2, 2));
console.log(o2s3.toParams());


console.log(JSON.stringify(o2sql.select().from('user').where({
  id: 2,
  sentAt: {
    '>=': o2sql.parse('now() - cast(\'10 minutes\' as integer)'),
  },
}).ast, 2, 2));


console.log(o2sql.select().from('project').where({
  id: 1,
  sector: {
    '&&': ['a', 'b', 'c'],
  },
  kind: ['a', 'b', 'c']
}).toParams());

console.log(o2sql.insertInto('project')
  .values([{
    favs: 3,
    likes: 5,
  }, {
    favs: o2sql.count('ua').where({
      tt: 3,
    }),
    likes: null,
  }]).toParams());


console.dir(o2sql('select').from({
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
}, 'id', 'name', ['class', 'className'], [o2sql.parse('convert(a, 101)'), 'dt']])
  .where({
    a: 1,
    b: 2,
    e: 'abcd',
    $or: { c: 3, d: 4 }
  })
  .groupby(['a.id', 'b.id'])
  .orderby(['a.id', '-b.id', ['c.id', 'desc']])
  .limit(4)
  .skip(8)
  .toParams());


console.dir(o2sql('select').columns([{ table: 'user', fields: ['name', 'age'] }]).from({ left: { name: 'user', alias: 'U' }, right: 'company' }).where({ 'user.id': 1 })
  .toParams());

console.dir(o2sql
  .get(['a', 'b'])
  .from({
    left: {
      name: 'company',
      key: 'userId',
    },
    right: 'user',
  })
  .where({
    id: {
      IN: o2sql.select(['id']).from('user').where(1),
    },
  }).toParams());
