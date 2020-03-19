A very simple tool to help generate postgres queries. "" will be added to table/field names.

.toParams() returns the following object, which could be used in node-postgres (https://www.npmjs.com/package/pg) directly.

```
{
  sql: '....',
  values: [...],
}
```

# Install

```
npm install o2sql
```

# Usage

## Basic

```
const o2sql = require('o2sql');
const params = o2sql.select(['id', 'name'])
  .from('user')
  .where(1)
  .toParams();
```

Then params will be:

```
{
  sql: 'select "id", "name" from "user" where "id" = $1',
  values: [4],
}
```

## toParams()

Everying inherits from ast, and can be transformed to {sql, values} by calling toParams().

# API

## identifier / i

```typescript
o2sql.identifier(name:string):IdentifierAst
```

Parse an identifier to ast.

```javascript
o2sql.i('user.name').toParams();

{ sql: '"user"."name"', values: [] }
```

- **ValueAst.op(op:string, right: string|number|Ast):ExprAst**

  ```javascript
  o2sql.i('age').op('+', 5).toParams();

  { sql: '"age" + $1', values: [ 5 ] }
  ```

- **ValueAst.and(right: string|number|Ast):ExprAst**

  Equals ValueAst.op('and', right:any):ExprAst

  ```javascript
  o2sql.i('show').and(o2sql.i('top')).toParams();

  { sql: '"show" AND "top"', values: [] }
  ```

- **ValueAst.or(right: string|number|Ast):ExprAst**

  Equals ValueAst.op('or', right:any):ExprAst

  ```javascript
  o2sql.i('show').or(o2sql.i('top')).toParams();

  { sql: '"show" OR "top"', values: [] }
  ```

## function / f

```typescript
o2sql.function(
  name:string,  // function name
  ...params:?string|number|Ast  // params
):FunctionAst
```

Parse a function to ast. First argument is funciton name, and rest for arguments.

```javascript
o2sql.f('foo', 1, 'abc').toParams();

{ sql: '"foo"($1,$2)', values: [ 1, 'abc' ] }
```

- **FunctionAst.op(op:string, right: string|number|Ast):ExprAst**

  ```javascript
  o2sql.f('foo', 3).op('+', 5).toParams();

  { sql: '"foo"($1) + $2', values: [ 3, 5 ] }
  ```

- **FunctionAst.and(right: string|number|Ast):ExprAst**

  Equals FunctionAst.op('and', right:any):ExprAst

  ```javascript
  o2sql.f('foo',o2sql.i('show')).and(o2sql.i('top')).toParams();

  { sql: '"foo"("show") AND "top"', values: [] }
  ```

- **FunctionAst.or(right: string|number|Ast):ExprAst**

  Equals FunctionAst.op('or', right:any):ExprAst

  ```javascript
  o2sql.f('foo',o2sql.i('show')).or(o2sql.i('top')).toParams();

  { sql: '"foo"("show") OR "top"', values: [] }
  ```

## value / v

```typescript
o2sql.value(value:string|number):ValueAst
```

Make a value ast.

```javascript
o2sql.v(5).toParams();

{ sql: '$1', values: [ 5 ] }
```

- **ValueAst.op(op:string, right: string|number|Ast):ExprAst**

  ```javascript
  o2sql.v(3).op('+', 5).toParams();

  { sql: '$1 + $2', values: [ 3, 5 ] }
  ```

- **ValueAst.and(right: string|number|Ast):ExprAst**

  Equals ValueAst.op('and', right:any):ExprAst

  ```javascript
  o2sql.v(true).and(o2sql.i('top')).toParams();

  { sql: '$1 AND "top"', values: [ true ] }
  ```

- **ValueAst.or(right: string|number|Ast):ExprAst**

  Equals ValueAst.op('or', right:any):ExprAst

  ```javascript
  o2sql.v(true).or(o2sql.i('top')).toParams();

  { sql: '$1 OR "top"', values: [ true ] }
  ```

## expr / e

```typescript
o2sql.expr(
  left:string|number|Ast,
  op:string,
  right:string|number|Ast
):ExprAst
```

Make an expression ast. This is very useful in UPDATE.

```javascript
o2sql.e(o2sql.i('count'), '+', 1).toParams();

{ sql: '"count" + $1', values: [ 1 ] }
```

This equals to:

```javascript
o2sql
  .i('count')
  .op('+', 1)
  .toParams();
```

- **ExprAst.op(op:string, right:string|number|Ast):ExprAst**

  ```javascript
  o2sql.e(5, '+', 6).op('*', 7).toParams();

  { sql: '($1 + $2) * $3', values: [ 5, 6, 7 ] }
  ```

  ```javascript
  o2sql.e(5, '+', 6).op('*', o2sql.i('rank')).toParams();

  { sql: '($1 + $2) * "rank"', values: [ 5, 6 ] }
  ```

- **ExprAst.and(right: string|number|Ast):ExprAst**

  Equals ValueAst.op('and', right:any):ExprAst

  ```javascript
  o2sql.e(o2sql.i('rank'), '=', 5).and(o2sql.i('top')).toParams();

  { sql: '"rank" = $1 AND "top"', values: [ 5 ] }
  ```

- **ExprAst.or(right: string|number|Ast):ExprAst**

  Equals ValueAst.op('or', right:any):ExprAst

  ```javascript
  o2sql.e(o2sql.i('rank'), '=', 5).or(o2sql.i('top')).toParams();

  { sql: '"rank" = $1 OR "top"', values: [ 5 ] }
  ```

## table / t

```javascript
o2sql.table(table:string|array|object):TableAst
```

- **table(table:string):TableAst**

```javascript
o2sql.t('user').toParams();

{ sql: '"user"', values: [] }
```

- **table([table:string, alias:string]:array):TableAst**

```javascript
o2sql.t(['user', 'U']).toParams();

{ sql: '"user" "U"', values: [] }
```

- **table({table:string, alias:string}:object):TableAst**

```javascript
o2sql.t({table:'user', alias:'U'}).toParams();

{ sql: '"user" "U"', values: [] }
```

About how to join tables, please see [join](###join) of Select.

## Select

```typescript
o2sql.select(columns:array)
  .distinct(distinct:string|array)
  .from(table:string|object)
  .where(where:object)
  .groupby(groupby:string|array)
  .orderby(orderby:string|array)
  .having(having:object)
  .limit(limit:number)
  .skip(skip:number)
  .union(union:Select)
```

```typescript
paginate(page:number, pageSize:number)
// short for .limit(limit).skip(skip)
```

### select

```javascript
o2sql.select(columns:array):Select
```

#### Basic

- column name

```javascript
o2sql.select(['id', 'name', 'dept.name']).toParams()

{ sql: 'SELECT "id","name","dept"."name"', values: [] }
```

- alias name

```javascript
o2sql.select(['deptId', ['dept.name', 'deptName']).toParams();

{ sql: 'SELECT "deptId","dept"."name" "deptName"', values: [] }
```

- cast value

```javascript
o2sql.select(['id', ['age', 'userAge', 'int']]).toParams();

{
  sql: 'SELECT "id",CAST("age" AS INTEGER) "userAge"',
  values: []
}
```

- function / expr

```javascript
o2sql.select([
  [o2sql.f('foo', o2sql.i('col1'), o2sql.i('col2'), 5), 'total'],
  [o2sql.e(o2sql.i('col3'), '+', '_append_string'), 'appendedString', 'string'],
])
  .toParams();

{
  sql: 'SELECT "foo"("col1","col2",$1) "total",CAST("col3" + $2 AS VARCHAR) "appendedString"',
  values: [ 5, '_append_string' ]
}
```

- sub query

```javascript
o2sql.select([
  [o2sql.select(['name']).from('group').where({id: o2sql.i('user.groupId')}), 'groupName']
])
  .from('user')
  .toParams();

{
  sql: 'SELECT (SELECT "name" FROM "group" WHERE "id" = "user"."groupId") "groupName" FROM "user"',
  values: []
}
```

#### Multi table

```javascript
o2sql.select([
  {
    table: 'user',
    fields: ['id', 'name', 'gender'],
  },
  {
    table: 'group',
    fields: ['id', 'name', ['category', 'kind']],
    prefix: 'group',
  },
  {
    table: 'company',
    fields: ['id', 'name'],
    prefix: 'company',
    separator: '_',
  }
]).toParams();

{
  sql: 'SELECT "user"."id" "userId","user"."name" "userName","user"."gender" "userGender","group"."id" "groupId","group"."name" "groupName","category" "groupKind","company"."id" "company_id","company"."name" "company_name"',
  values: []
}

```

Mixed usage is also supported, but you need to make sure every plain field is unique.

```javascript
o2sql.select([
  'firstName',
  'lastName',
  {
    table: 'group',
    fields: ['id', 'name', ['category', 'kind']],
    prefix: 'group',
  }
]).toParams();

{
  sql: 'SELECT "firstName","lastName","group"."id" "groupId","group"."name" "groupName","category" "groupKind"',
  values: []
}
```

### distinct

```javascript
.distinct(distinct:?array):Select
```

- **distinct all**

```javascript
o2sql.select(['id', 'name', 'groupId'])
  .distinct()
  .toParams();

{ sql: 'SELECT DISTINCT "id","name",groupId"', values: [] }
```

- **disinct on**

```javascript
o2sql.select(['id', 'name', 'groupId'])
  .from('user')
  .distinct(['groupId'])
  .toParams();

{
  sql: 'SELECT DISTINCT ON ("groupId") "id","name","groupId" FROM "user"',
  values: []
}
```

### from

```javascript
Select.from(table:string|array|TableAst|object):Select
```

See [table / t](##table / t) for param details.

```javascript
o2sql.select(['id'])
  .from(o2sql.t('user'))
  .toParams();

{ sql: 'SELECT "id" FROM "user"', values: [] }
```

```javascript
o2sql.select(['id'])
  .from(o2sql.t('user').innerJoin('dept', ['user.deptId', 'dept.id']))
  .toParams();

{
  sql: 'SELECT "id" FROM "user" INNER JOIN "dept" ON "user"."deptId" = "dept"."id"',
  values: []
}
```

### join

```javascript
Select.innerJoin(table:string|array|tableAst|object,on:array|object):Select
Select.leftJoin(table:string|array|tableAst|object,on:array|object):Select
Select.rightJoin(table:string|array|tableAst|object,on:array|object):Select
Select.fullJoin(table:string|array|tableAst|object,on:array|object):Select
Select.crossJoin(table:string|array|tableAst|object,on:array|object):Select
```

- **table:string|array|object**

  See [table / t](##table / t) for param details.

- **table:TableAst**

  ```javascript
  o2sql.select(['id'])
    .from('user')
    .innerJoin(
      o2sql.table('dept')
        .innerJoin(
          'org',
          ['dept.orgId','org.id']
         ),
      ['user.deptId', 'dept.id']
    ).toParams();

  {
    sql: 'SELECT "id" FROM "user" INNER JOIN ("dept" INNER JOIN "org" ON "dept"."orgId" = "org"."id" ON "user"."deptId" = "dept"."id")',
    values: []
  }
  ```

* ##### on:array

```javascript
o2sql.select(['id'])
  .from('user')
  .join('group', ['groupId', 'group.id'])
  .toParams();

{
  sql: 'SELECT "id" FROM "user" INNER JOIN "group" ON "groupId" = "group"."id"',
  values: []
}
```

- **on:object**

```javascript
o2sql.select(['id'])
  .from('user')
  .rightJoin('group', {
    left: o2sql.i('groupId'),
    op: '=',
    right: o2sql.i('group.id'),
  })
  .toParams();

{
  sql: 'SELECT "id" FROM "user" RIGHT JOIN "group" ON "groupId" = "group"."id"',
  values: []
}
```

- **on:ExprAst**
  Advanced usage.

```javascript
o2sql
  .select(['id'])
  .from('user')
  .join(
    'group',
    o2sql.i('groupId').op('=', o2sql.i('group.id'))
      .and(o2sql.i('group.kind').op('=', 'admin'))
  )
  .toParams();

{
  sql: 'SELECT "id" FROM "user" INNER JOIN "group" ON "groupId" = "group"."id" AND "group"."kind" = $1',
  values: [ 'admin' ]
}
```

### where:

```javascript
where(where:string|number|array|object):Select
```

#### Number/String

```javascript
where(id:string|number):Select
// equals to
where({
  id:string|number
}):Select
```

```javascript
o2sql.select(['id']).from('user').where(1).toParams();

{
  sql: 'SELECT "id" FROM "user" WHERE "id" = $1',
  values: [ 1 ]
}
```

#### AND

```javascript
o2sql.select(['id'])
  .from('user')
  .where({
    groupId: 3,
    gender: 'M',
  })
  .toParams();

{
  sql: 'SELECT "id" FROM "user" WHERE "groupId" = $1 AND "gender" = $2',
  values: [ 3, 'M' ]
}
```

#### OR

- **where(where:array)**

  ```javascript
  o2sql.select(['id'])
    .from('user')
    .where([
      {
        groupId: 3
      },
      {
        groupId: 4
      }
    ]).toParams();

  {
    sql: 'SELECT "id" FROM "user" WHERE "groupId" = $1 OR "groupId" = $2',
    values: [ 3, 4 ]
  }
  ```

- **OR in AND**

  - If the name of an attribute startsWith '\$' and value is an array (this feature will be removed in the next main version).
  - OR the name of an attribute is a Symbol and value is an array.

  ```javascript
  o2sql.select(['id'])
    .from('user')
    .where({
      gender: 'M',
      [Symbol()]:[
        {
          groupId: 3
        },
        {
          groupId: 4,
          rank: 2,
        }
      ]
    }).toParams();

  {
    sql: 'SELECT "id" FROM "user" WHERE "gender" = $1 AND ("groupId" = $2 OR "groupId" = $3 AND "rank" = $4)',
    values: [ 'M', 3, 4 ]
  }
  ```

#### Other operators

```javascript
o2sql.select(['id'])
  .from('user')
  .where({
    groupId: 3,
    gender: 'M',
    vip: false,
    address: {
      '<>': null,
    },
    grade: null,
    age: {
      '>=': 18,
      '<': 60
    },
    role: ['user', 'admin'],
    name: {
      ILIKE: '%Mia%'
    },
    sectors: {
      '&&': ['a', 'b', 'c'],
      '@>': ['a', 'b'],
    }
  })
  .toParams();

{
  sql: 'SELECT "id" FROM "user" WHERE "groupId" = $1 AND "gender" = $2 AND "vip" = $3 AND "address" IS NOT NULL AND "grade" IS NULL AND "age" >= $4 AND "age" < $5 AND "role"=ANY(ARRAY[$6,$7]::VARCHAR[]) AND "name" ILIKE $8 AND "sectors" && ARRAY[$9,$10,$11]::VARCHAR[] AND "sectors" @> ARRAY[$12,$13]::VARCHAR[]',
  values:
   [ 3,
     'M',
     false,
     18,
     60,
     'user',
     'admin',
     '%Mia%',
     'a',
     'b',
     'c',
     'a',
     'b' ]
}

```

#### Subquery

```javascript
o2sql.select(['id', 'name'])
  .from('user')
  .where({
    groupId: {
      IN: o2sql.select(['id']).from('group').where({
        groupKind: 'a',
      }),
    }
  })
  .toParams();

{
  sql: 'SELECT "id","name" FROM "user" WHERE "groupId"=ANY(SELECT "id" FROM "group" WHERE "groupKind" = $1)',
  values: [ 'a' ]
}
```

#### Free mode

```javascript
o2sql.select(['id'])
  .from('user')
  .where({
    [Symbol()]: {
       $left: o2sql.f('foo'),
      $op: '>=',
      $right: o2sql.i('age'),
    },
  })
  .toParams();

{
  sql: 'SELECT "id" FROM "user" WHERE "foo"() >= "age"',
  values: []
}
```

```javascript
o2sql
  .select(['id'])
  .from('user')
  .where(o2sql.e(o2sql.i('age'), '>', 18))
  .toParams();

{
  sql: 'SELECT "id" FROM "user" WHERE "age" > $1',
  values: [18]
}
```

### groupby

```javascript
groupby(groupby:string|array):Select
```

```javascript
o2sql.select(['role', [o2sql.f('count', o2sql.i('id')), 'count']])
  .from('user')
  .groupby(['role'])
  // .groupby('role')
  .toParams();

{
  sql: 'SELECT "role","count"("id") "count" FROM "user" GROUP BY "role"',
  values: []
}
```

### orderby

```javascript
orderby(order:string|array):Select
```

```javascript
o2sql.select(['id', 'name'])
  .from('user')
  .orderby(['id', '-name'])
  // .orderby(['id', ['name', 'DESC']])
  // .orderby('id')
  .toParams();

{
  sql: 'SELECT "id","name" FROM "user" ORDER BY "id" ASC,"name" DESC',
  values: []
}
```

### having

```javascript
having(having::string|number|array|object):Select
```

Same as [where](###where)

### paginate, limit and skip

```javascript
limit(limit:int).skip(skip:int):Select

paginate(page:int, pageSize:int):Select
// equals
limit(pageSize).skip(pageSize * (page - 1))
```

```javascript
o2sql
  .select(['id', 'name'])
  .from('user')
  .paginate(2, 10)
  .toParams();

{
  sql: 'SELECT "id","name" FROM "user" LIMIT $1 OFFSET $2',
  values: [ 10, 10 ]
}
```

### union

```javascript
o2sql
  .select(['id', 'name'])
  .from('dept1')
  .where({ orgId: 5 })
  .union(
    o2sql
    .select(['id', 'name'])
    .from('dept2')
    .where({ orgId: 3 })
  )
  .toParams();

{
  sql: 'SELECT "id","name" FROM "dept1" WHERE "orgId" = $1 UNION ALL SELECT "id","name" FROM "dept2" WHERE "orgId" = $2',
  values: [ 5, 3 ]
}
```

## Get

```
o2sql.get(columns:array)
  .distinct(distinct:string|array)
  .from(table:string|object)
  .where(where:object)
  .groupby(groupby:string|array)
  .orderby(orderby:string|array)
  .having(having:object)
  .skip(skip:number)
```

Get inherits from Select, and set limit(1) automatically. There's no limit and union method, others are the same with select.

```javascript
o2sql.get(['id', 'name'])
  .from('user')
  .toParams();

{
  sql: 'SELECT "id","name" FROM "user" LIMIT $1',
  values: [ 1 ]
}
```

## Count

```javascript
o2sql.count((table: string)).where((where: object));
o2sql
  .count((columns: array))
  .distinct((distinct: string | array))
  .from((table: string | object))
  .where((where: object))
  .groupby((groupby: string | array))
  .orderby((orderby: string | array))
  .having((having: object));
```

```javascript
o2sql
  .count('user')
  .where({
     groupId: 1,
   })
   .toParams();

{
  sql: 'SELECT COUNT(*)::INTEGER AS count FROM "user" WHERE "groupId" = $1',
  values: [ 1 ]
}
```

```javascript

o2sql
  .count(['companyId'])
  .from('user')
  .where({
    groupd: 1,
  })
  .distinct()
   .toParams();
// OR
o2sql
  .count('user')
  .select(['companyId'])
  .where({
    groupd: 1,
  })
  .distinct()
   .toParams();

{
  sql: 'SELECT DISTINCT COUNT("companyId")::INTEGER AS count FROM "user" WHERE "groupd" = $1',
  values: [ 1 ]
}
```

## Insert

```javascript
o2sql.insert(values:object|array)
  .into(table:string);
  .returning(columns:array);

o2sql.insertInto(table:name)
  values(values:object|array)
  .returning(columns:array);
```

```javascript
o2sql.insertInto('user')
  .values({
    name: 'Echo',
    age: 35,
  })
  .returning(['id', 'name'])
  .toParams();

{
  sql: 'INSERT INTO "user"("name","age") VALUES ($1,$2) RETURNING "id","name"',
  values: [ 'Echo', 35 ]
}
```

## Update

```javascript
o2sql
  .update((table: string))
  .set((value: object))
  .where((where: object));
```

```javascript
o2sql
  .update('user')
  .set({
    name: 'Echo',
    age: 34,
    count: o2sql.i('count').op('+', 1),
    favs: o2sql.count('userFav').where({
      userId: o2sql.i('user.id'),
    }),
  })
  .where({
    id: 1,
  })
  .toParams();
```

```javascript
{
  sql: 'UPDATE "user" SET "name"=$1,"age"=$2,"count"="count" + $3,"favs"=(SELECT COUNT(*)::INTEGER AS count FROM "userFav" WHERE "userId" = "user"."id") WHERE "id" = $4',
  values: [ 'Echo', 34, 1, 1 ]
}
```

innerJoin, leftJoin, rightJoin, fullJoin also supported.

## Delete

```javascript
o2sql.delete((table: string)).where((where: object));
```

```javascript
o2sql.delete('user').where(2).toParams();

{ sql: 'DELETE FROM "user" WHERE "id" = $1', values: [ 2 ] }
```

# Integrate with pg

## 1. set execute handler

```javascript
// set execute handler when you init the app
const { Pool } = require('pg');
const pool = new Pool(config);

const o2sql = require('o2sql');

o2sql.setOnExecuteHandler(async function({ sql: text, values }, client) {
  const { rowCount, rows } = await (client ? client : pool).query({
    text,
    values,
  });

  let result;
  if (this instanceof o2sql.command.Count) {
    result = rows[0].count;
  } else if (this instanceof o2sql.command.Insert) {
    if (rowCount === 0) return null;
    else if (rowCount === 1) return rows[0];
    else return rows;
  } else if (
    this instanceof o2sql.command.Update ||
    this instanceof o2sql.command.Delete
  ) {
    return rowCount.length > 0 ? rows : null;
  } else if (this instanceof o2sql.command.Get) {
    return rowCount.length > 0 ? rows[0] : null;
  } else {
    return rows;
  }
});
```

## 2. execute

### query

```javascript
const user = await o2sql.get(['name', 'age'])
  .from('user')
  .where({
    id: 1,
  })
  .execute();

{ name: 'Echo Chen', age: 35 }
```

### transaction

Refer to https://node-postgres.com/features/transactions for more about transactions in pg.

Here is just an example, write your own code accordingly.

```javascript
const { Pool } = require('pg');
const pool = new Pool();

(async () => {
  const client = pool.connect();
  try {
    await client.query('BEGIN');

    await o2sql
      .get(['name', 'age'])
      .from('user')
      .where({
        id: 1,
      })
      .execute(client);

    await o2sql
      .delete('user')
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

$$
$$

$$
$$

```

```

```

```

```

```
