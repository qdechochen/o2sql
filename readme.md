## osql


## select
```
// simple eg.
const o2s1 = osql('select')
  .from('user')
  .columns(['id', 'name'])
  .where({
    id: 1,
  })

console.log(o2s1.toParams);

// complex eg.
const o2s2 = osql('select').from({
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
  age: {
    IN: osql.select(['age']).from('ua').where({
      tt: 3,
    }).ast,
  },
  sector: {
    '&&': ['a', 'b', 'c'],
  },
  $$2: {
    left: osql.parse('f(2,3)'),
    op: '>=',
    right: osql.parse('f(3,4)'),
  },
  $$3: {
    left: 'f1',
    op: '>=',
    right: osql.parse('f(3,4)'),
  },
}).groupby(['a.id', 'b.id'])
  .orderby(['a.id', '-b.id', ['c.id', 'desc']])
  .limit(4)
  .skip(8);

console.log(o2s2.toParams);

osql.select(['f1', 'f2])
  .from('tableName')
  ....
```

## get
```
const o2s = osql('get').from('user')
  .where({
    id: 1,
  })

console.log(o2s.toParams);
osql.get(['f1', 'f2])
  .from('tableName')
```

## insert
```
const o2s = osql('insert').into('user')
  .set({
    name: 'Echo',
    age: 34,
  })
  .returning(['id']);
console.log(o2s.toParams);

osql.insert({
  name: 'Echo',
  age: 34,
})
  .into('user')
  .returning(['id'])
  
osql.insertInto('user')
  .values({
    name: 'Echo',
    age: 34,
  })
  .returning(['id'])

```

## update
```
const o2s = osql('update').table('user')
  .set({
    name: 'Echo',
    age: 34,
    count: osql.parse('"count" + 1'),
  })
  .where({
    id: 1,
  });

console.log(o2s.toParams);
osql.update('tableName')
  .set({
    name: 'Echo',
  })
  ....
```

## delete
```
const o2s = osql('delete').from('user')
  .where({
    id: 1,
  })

console.log(o2s.toParams);
osql.delete('user').where(...);
```

## execute handler (working with pg)
```
// set execute handler when init your app
const pool = new Pool(config);

osql.setOnExecuteHandler(async function({ sql: text, values }, client) {
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


// use execute
const user = await osql('get')
  .from('user')
  .select(['name', 'age'])
  .where({
    id: 1,
  })
  .execute();

```
