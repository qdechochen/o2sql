## o2sql

A simple tools to help generate postgres queries. 

.toParams() will retun:
```
{
  sql: '....',
  values: [...],
}
```

## select
```
// simple eg.
const o2s1 = o2sql('select')
  .from('user')
  .columns(['id', 'name'])
  .where({
    id: 1,
  })

console.log(o2s1.toParams());

// complex eg.
const o2s2 = o2sql('select').from({
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
  $$: `'abc'=ANY("ancestors")`,
  age: {
    IN: o2sql.select(['age']).from('ua').where({
      tt: 3,
    }).ast,
  },
  sector: {
    '&&': ['a', 'b', 'c'],
  },
  $$2: {
    left: o2sql.parse('f(2,3)'),
    op: '>=',
    right: o2sql.parse('f(3,4)'),
  },
  $$3: {
    left: 'f1',
    op: '>=',
    right: o2sql.parse('f(3,4)'),
  },
}).groupby(['a.id', 'b.id'])
  .orderby(['a.id', '-b.id', ['c.id', 'desc']])
  .limit(4)
  .skip(8);

console.log(o2s2.toParams());

o2sql.select(['f1', 'f2])
  .from('tableName')
  ....
```

## get
```
const o2s = o2sql('get').from('user')
  .where({
    id: 1,
  })

console.log(o2s.toParams());
o2sql.get(['f1', 'f2])
  .from('tableName')
```

## insert
```
const o2s = o2sql('insert').into('user')
  .values([{
    name: 'Echo',
    age: 34,
    likes: o2sql.count('ul').where({
      tt: 3,
    })
  }, {
    name: 'Echo',
    age: 34,
    likes: 5,
  }])
  .returning(['id']);
console.log(o2s.toParams());

o2sql.insert({
  name: 'Echo',
  age: 34,
})
  .into('user')
  .returning(['id'])
  
o2sql.insertInto('user')
  .values({
    name: 'Echo',
    age: 34,
  })
  .returning(['id'])

```

## update
```
const o2s = o2sql('update').table('user')
  .set({
    name: 'Echo',
    age: 34,
    count: o2sql.parse('"count" + 1'),
    likes: o2sql.count('ul').where({
      tt: 3,
    })
  })
  .where({
    id: 1,
  });

console.log(o2s.toParams());
o2sql.update('tableName')
  .set({
    name: 'Echo',
  })
  ....
```

## delete
```
const o2s = o2sql('delete').from('user')
  .where({
    id: 1,
  })

console.log(o2s.toParams());
o2sql.delete('user').where(...);
```

## execute handler (working with pg)
```
// set execute handler when init your app
const pool = new Pool(config);

o2sql.setOnExecuteHandler(async function({ sql: text, values }, client) {
  console.dir({
    text,
    values,
  });
  const result = await (client ? client : pool).query({ text, values });
  if (this.command === 'select') {
    if (this.isGet) {
      return result.rows.length > 0 ? result.rows[0] : null;
    } else if (this.isCount) {
      return result.rows[0].count;
    }
    return result.rows;
  } else if (this.command === 'insert') {
    return result.rows[0];
  } else if (this.command === 'update') {
    return result.rows[0];
  } else if (this.command === 'delete') {
    return result;
  }
});


// execute
const user = await o2sql.get(['name', 'age'])
  .from('user')
  .where({
    id: 1,
  })
  .execute();

```
