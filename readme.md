# o2sql

A very simple tool to help generate postgres queries. "" will be added to table/field names.

.toParams() will retun the following object, which could be used in node-postgres (https://www.npmjs.com/package/pg) directly.
```
{
  sql: '....',
  values: [...],
}
```

## toParams
```
o2sql.select(['id', 'name'])
  .from('user')
  .where(4)
  .toParams();
```
```
{
  sql: 'select "id", "name" from "user" where "id" = $1',
  values: [4],
}
```


## parse
Parse a sql string to ast. You need to make sure the string you pass is part of standard sql.
```
o2sql.parse('count + my_func(p1, p2, 4)')
```

## select
```
o2sql.select(columns)
  .from(table)
  .where(conditions)
  .groupby(groupby)
  .orderby(orderby)
  .having(having)
  .limit(limit)
  .skip(skip)
```
```
paginate(page, pageSize)
```

### About columns:
#### Basic (plain)
```
['id', 'gender', ['name', 'userName']]
// "id", "gender", "name" AS "userName"
```

#### Multi table
```
[{
  table: 'user',
  fields: ['id', 'name', 'gender'],
}, {
  table: 'group',
  fields: ['id', 'name', ['category', 'kind'],
  prefix: 'group',
}, {
  table: 'company',
  fields: ['id', 'name'],
  prefix: 'company',
  separator: '_',
}]
//
"id", "name", "gender", "groupId", "groupName", "groupKind", "company_id", "company_name"
```
Mixed usage is also supported, but you need to make sure every plain field is unique.
```
['firstName', 'lastName', {
  table: 'group',
  fields: ['id', 'name', ['category', 'kind'],
  prefix: 'group',
}]
```

### About tables:
#### Basic (plain)
```
'user'
```
#### Join
```
{
  left: {
    name: 'user',
    key: 'groupId',
  },
  right: {
    name: 'group',
    key: 'id',
  },
}
// "user" INNER JOIN "group" ON "user"."groupId"="group"."id"
```
```
{
  left: {
    name: 'user',
    alias: 'U',
  },
  right: {
    name: 'group',
    alias: 'G',
  },
  join: 'LEFT JOIN',
  on: 'U.groupId=G.id'
}
// "user" "U" LEFT JOIN "group" "G" ON "U"."groupId" = "G"."id"
```
```
{
  right: {
    left: {
      name: 'user',
      alias: 'U',
    },
    right: {
      name: 'group',
      alias: 'G',
    },
    join: 'LEFT JOIN',
    on: 'U.groupId=G.id',
    key: 'U.companyId',
  },
  right: {
    name: 'company',
    key: 'id',
  },
}
// "user" "U" LEFT JOIN "group" "G" ON "U"."groupId" = "G"."id" INNER JOIN "company" ON "U"."companyId" = "company"."id"
```
```
{
  left: {
    name: 'user',
    alias: 'U',
  },
  right: {
    left: {
      name: 'group',
      alias: 'G',
      key: 'groupKindId',
    },
    right: {
      name: 'groupKind',
      alias: 'GK',
      key: 'id',
    },
  },
  join: 'LEFT JOIN',
  on: 'U.groupId=G.id',
}
// "user" "U" LEFT JOIN ("group" "G" INNER JOIN "groupKind" "GK" ON "G"."groupKindId" = "GK"."id") ON "U"."groupId" = "G"."id"
```

### About where:

#### Number/String
where(8) is short for where({ id: 8 })


#### AND
```
{
  groupId: 3,
  gender: 'M',
}
// "groupId" = $2 AND "gender" = $1
```
$1, $2 will be pushed in **values**

#### OR
```
{
  $or: {
    groupId: 3,
    gender: 'M',
  }
}
// ("groupId" = $2 OR "gender" = $1)
```

#### Other operators
```
{
  name: {
    "IS NOT": null,
  },
  title: {
    LIKE: '%abc',
  },
  age: [22, 23, 24],
  sector: {
    '&&': ['a', 'b', 'c'],
  },
}
// "name" IS NOT NULL AND "title" like $7 AND "age" IN ($4,$5,$6) AND "sector" && ARRAY[$1,$2,$3]::VARCHAR[]
```
Many operators are supported, eg. >=, ILIKE, ...

#### Free mode
```
{
  $$: 'id=ANY(1,2,3)',
  $$2:`(gender='M' OR "groupKind"=3)`,
  $$3: {
    left: o2sql.parse('my_function1(field1)'),
    op: '>=',
    right: o2sql.parse('my_function2(field2, field3)'),
  },
}
// "id" = ANY($3, $4, $5) AND ("gender" = $2 OR "groupKind" = $1) AND my_function1("field1") >= my_function2("field2", "field3")
```
** You just need to give it a key starts with $$.

#### Subquery

```
{
  groupId: {
    IN: o2sql.select(['id']).from('group').where({
      groupKind: 'a',
    }),
  }
}
// "groupId" IN (SELECT "id" FROM "group" WHERE "groupKind" = $1)
```

### groupby
```
groupby(['user.groupId', 'user.kind'])
```

### orderby
```
order(['id', '-name', ['gender', 'desc']])
```
-name is shor for ['name', 'desc']

### having
```
having(having)
```
Same as where

### paginate, limit and skip
```
limit(10).skip(20)
```
```
pagenate(page, pageSize)
```
is short for:
```
limit(pageSize).skip(pageSize * (page - 1))
```


## get
```
o2sql.get(columns)
  .from(table)
```

get(columns) is short for:
```
o2sql('get')
  .select(columns)
```
get is same as select, and it set limit(1) automatically.

## count
```
o2sql.count(table)
  .where(where)
```

where for count is same as where for select.

## insert
```
o2sql.insert(values)
  .into(table);
  .returning(columns);

o2sql.insertInto(table)
  values(values)
  .returning(columns);
```
If values is an Object, it will insert one record. If values is an Array of Object, it will insert multiple records.

Eg.
```
o2sql.insertInto('user')
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
  .returning(['id', 'name']);
```
```
  {
    sql:
   'INSERT INTO "user" ("name","age","likes") VALUES ($1,$2,(SELECT COUNT(*)::int AS "count" FROM "ul" WHERE "tt" = $3)),($4,$5,$6) RETURNING "id", "name"',
    values: [ 'Echo', 34, 3, 'Echo', 34, 5 ],
  }
```


## update
```
o2sql.update(table)
  .set(value)
  .where(where)
```

Eg.
```
o2sql.update('user')
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
```
```
{
  sql:
   'UPDATE "user" SET "name"=$1, "age"=$2, "count"="count" + $3, "likes"=(SELECT COUNT(*)::int AS "count" FROM "ul" WHERE "tt" = $4) WHERE "id" = $5',
  values: [ 'Echo', 34, 1, 3, 1 ],
}
```
## delete
```
o2sql.delete('user').where(2)

o2sql.delete('user')
  .where({
    id: 1,
  })
```
where is required for delete, in case you delete all records.


## execute handler (working with pg)
```
// set execute handler when you init your app
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
const { Pool } = require('pg');
const pool = new Pool();

(async () => {
  try {
    await client.query('BEGIN');

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

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
})().catch(e => console.error(e.stack));

```
