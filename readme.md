# o2sql

A very simple tool to help generate postgres queries. "" will be added to table/field names.

.toParams() will retun the following object, which could be used in node-postgres (https://www.npmjs.com/package/pg) directly.

```
{
  sql: '....',
  values: [...],
}
```

- This READ is still ONLY for v2. v3 has some small changes, and manual will be avaiable later. \*

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

## identifier / i

Parse an identifier to ast.

```
o2sql.identifier('user.name')
o2sql.i('user.name')
```

## function / f

Parse a function to ast. First argument is funciton name, and rest for arguments.

```
o2sql.function('func_name', p1);
o2sql.f('func_name', p1, p2, p3);
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
['id', 'gender', ['name', 'userName'], ['age', 'userAge', 'int'], [o2sql.function('func_name', o2sql.identifier('name'), 2), 'cal_value'], [o2sql.select(['id']).from('anotherTable').where(1), 'subQuery']]
// "id", "gender", "name" AS "userName", "age"::int AS "userAge", "func_name"("name", $1) AS "cal_value", (SELECT "id" FROM "anotherTable" WHERE "id" = $2) AS "subQuery"
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

### About distinct:

```
o2sql.select(['id', 'group'])
  .from('user')
  .distinct()
// select distinct "id", "group" from "user"
```

```
o2sql.select(['id', 'group', 'name'])
  .from('user')
  .distinct(['id', 'group']);
// SELECT distinct on ( "id", "group" ) "id", "group", "name" FROM "user"
```

### About tables:

o2sql.selct(['id']).from(table)

#### Basic (plain)

```
'user'
```

#### Join

##### Chaining style

o2sql.select(['id])
.from(tableA)
.join(tableB, on, isMainTable)

```
.from('user')
.join('group', ['groupId', 'id'])
// FROM "user" INNER JOIN "group" ON "user"."groupId" = "group"."id"
```

```
.from('user')
.join('group', {
  'user.groupId': o2sql('group.id'),
})
.leftJoin('dept', {
  'user.kind': 'normal',
  $$: {
    left: o2sql('user.gid'),
    op: '=',
    right: o2sql('group.id'),
  },
})
.rightJoin('organization', ['orgId', 'id'])
// FROM "user" INNER JOIN "group" ON "user"."groupId" = "group"."id" LEFT JOIN "dept" ON "user"."kind" = $1 AND "user"."gid" = "group"."id" RIGHT JOIN "organization" ON "user"."orgId" = "organization"."id"
```

main table could be set in two ways

```
.join('dept', [...], true)
```

OR

```
.join({
  name: 'dept',
  main: true,
}, [...])
```

##### Object style

o2sql.selct(['id']).from(objectStyleTable)

```
{
  left: {
    name: 'user',
    key: 'groupId',
    main: true, // all fields without table name will be prepended "user".
  },
  right: {
    name: 'group',
    key: 'id',
  },
}
// "user" INNER JOIN "group" ON "user"."groupId"="group"."id"
```

on is a "where" like object.

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
  on: {
    'U.groupId': o2sql('G.id'),
  },
}
// "user" "U" LEFT JOIN "group" "G" ON "U"."groupId" = "G"."id"
```

```
{
  left: {
    left: {
      name: 'user',
      alias: 'U',
    },
    right: {
      name: 'group',
      alias: 'G',
    },
    join: 'LEFT JOIN',
    on: {
      'U.kind': 'normal',
      $$: {
        left: o2sql('U.gid'),
        op: '=',
        right: o2sql('G.id'),
      },
    },
    key: 'U.companyId',
  },
  right: {
    name: 'company',
    key: 'id',
  },
}
// "user" "U" LEFT JOIN "group" "G" ON "U"."kind" = $1 AND "U"."gid" = "G"."id" INNER JOIN "company" ON "U"."companyId" = "company"."id"
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
  on: {
    'U.groupId': o2sql('G.id'),
  },
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

1. Any key starts with \$ will be ignored, and its value will be treated seperately;
2. OR wil be used if the key is ignored, and its value is an array.

```
{
  $or: [{
      groupId: 3,
    }, {
      gender: 'M',
    }],
}
// ("groupId" = $2 OR "gender" = $1)
```

```
{
  $or1: [{
      groupId: 3,
    }, {
      gender: 'M',
    }],
  $or2: [{
      groupId: 4,
    }, {
      gender: 'F',
    }],
}
// ("groupId" = $4 OR "gender" = $3) AND ("groupId" = $2 OR "gender" = $1)
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
    '@>': ['a', 'b'],
  },
  groupId: {
    '&&': [1, 2, 3],
  },
  stars: {
    between: [3,5];
  }
}
// "name" IS NOT NULL AND "title" LIKE $18 AND "age" IN ($15,$16,$17) AND "sector" && ARRAY[$12,$13,$14]::VARCHAR[] AND "sector" @> ARRAY[$10,$11]::VARCHAR[] AND "groupId" && ARRAY[$7,$8,$9]::INTEGER[] AND "stars" BETWEEN $2 AND $3
```

Many operators are supported, eg. >=, ILIKE, ...

#### Free mode

```
{
  $1: {
    $left: o2sql.f('my_function1', o2sql.i('field1')),
    $op: '>=',
    $right: o2sql.i('field2'),
  },
}
// "id" = ANY($3, $4, $5) AND ("gender" = $2 OR "groupKind" = $1) AND my_function1("field1") >= my_function2("field2", "field3")
```

\*\* You just need to give it a key starts with \$\$.

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

```
o2sql.select(['id', 'name']).from({
  left: {
    name: o2sql
      .select(['id', 'name', 'deptId'])
      .from('dept')
      .where({ orgId: 5 }),
    key: 'id',
    alias: 'myDept',
  },
  right: {
    name: 'user',
    key: 'deptId',
  }
});
// SELECT "id", "name" FROM (SELECT "id", "name", "deptId" FROM "dept" WHERE "orgId" = $1) "myDept" INNER JOIN "user" ON "myDept"."id" = "user"."deptId"
```

### groupby

```
groupby(['user.groupId', 'user.kind'])
```

```
// If you set main table to user
groupby(['groupId', '.random'])
// group by "user"."groupId", "random"
```

### orderby

```
order(['id', '-name', ['gender', 'desc']])
```

-name is shor for ['name', 'desc']

```
// If you set main table to user
orderby(['groupId', '.random'])
// order by "user"."groupId", "random"
// This is very useful when you have computed field like [o2sql.f('random'), 'random']
```

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
paginate(page, pageSize)
```

is short for:

```
limit(pageSize).skip(pageSize * (page - 1))
```

### union

```
o2sql
  .select(['id', 'name'])
  .from('dept1')
  .where({ orgId: 5 })
  .union(
    o2sql
      .select(['id', 'name'])
      .from('dept2')
      .where({ orgId: 3 })
  );
// SELECT "id", "name" FROM "dept1" WHERE "orgId" = $1 UNION SELECT "id", "name" FROM "dept2" WHERE "orgId" = $2
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
o2sql.count(table)  // table should be a string or object, same as from of 'select'
  .where(where)
  .distinct()
```

```
o2sql.count(columns)  // colmns should be an array
  .from(from)
  .distinct()
```

```
o2sql
  .count('user')
  .where({
    groupd: 1,
  })
// SELECT count( * )::INTEGER AS count FROM "user" WHERE "groupd" = $1
```

```
o2sql
  .count(['companyId'])
  .from('user')
  .where({
    groupd: 1,
  })
  .distinct();
// OR
o2sql
  .count('user')
  .select(['companyId'])
  .where({
    groupd: 1,
  })
  .distinct();
// SELECT count( distinct "companyId" )::INTEGER AS count FROM "user" WHERE "groupd" = $1
```

where for count is same as where for select.
join, leftJoin, rightJoin is also supported.

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
    count: o2sql.expr(o2sql.i('count'), '+', 1),
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
