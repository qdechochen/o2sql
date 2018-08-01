```
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
  $$: `'abc'=ANY("ancestors")`,
}).groupby(['a.id', 'b.id'])
  .orderby(['a.id', '-b.id', ['c.id', 'desc']])
  .limit(4)
  .skip(8);
```