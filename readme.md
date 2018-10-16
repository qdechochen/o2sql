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
  $or: { c: 3, d: 4 },
  $$: `'abc'=ANY("ancestors")`,
  age: {
    IN: o2sql.select(['age']).from('ua').where({
      tt: 3,
    }).ast,
  },
  sector: {
    '&&': ['a', 'b', 'c'],
  },
  $$2: {  // just needs to start with $$.
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
```
toParams will return the following object, which could be used in node-postgres (https://www.npmjs.com/package/pg) directly.
```
{
  sql:
    `SELECT "U"."id" AS "user_id", "U"."name" AS "user_name", "id", "name", "class" AS "className", convert("a", $1) AS "dt"
    FROM "user" "U"
      INNER JOIN "class" "C" ON "U"."classId" = "C"."id"
      INNER JOIN "grade" "G" ON "U"."gradeId" = "G"."id"
    WHERE "a" = $17
      AND "b" = $16
      AND "e" = $15
      AND "c" = $14
      OR "d" = $13
      AND $12 = ANY("ancestors")
      AND "age" IN (
        SELECT "age"
        FROM "ua"
        WHERE "tt" = $11
      )
      AND "sector" && ARRAY[$8,$9,$10]::VARCHAR[]
      AND f($6, $7) >= f($4, $5)
      AND "f1" >= f($2, $3)
    GROUP BY "a"."id", "b"."id"
    ORDER BY "a"."id" ASC, "b"."id" DESC, "c"."id" DESC
    LIMIT $18 OFFSET $19`,
  values:
    [101, 3, 4, 3, 4, 2, 3, 'a', 'b', 'c', 3, 'abc', 4, 3, 'abcd', 2, 1, 4, 8]
};
```
```
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
const { Pool } = require('pg')
const pool = new Pool(config);

const o2sql = require('o2sql');
o2sql.setOnExecuteHandler(async function({ sql: text, values }, client) {
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
```
### execute: query
```
const user = await o2sql.get(['name', 'age'])
  .from('user')
  .where({
    id: 1,
  })
  .execute();

```

### execute: with transaction
Refer to https://node-postgres.com/features/transactions for more about transactions in pg.
```
const { Pool } = require('pg')
const pool = new Pool()

(async () => {
  try {
    await client.query('BEGIN')

    await o2sql.get(['name', 'age'])
      .from('user')
      .where({
        id: 1,
      })
      .execute(client);
    await o2sql.delete('user')
      .where({
        id: 1,
      })
      .execute(client);

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
})().catch(e => console.error(e.stack))

```
