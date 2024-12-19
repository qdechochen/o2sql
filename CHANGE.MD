# CHANGE LOG

## 4.0.20

1. added: case(when, trueValue, falseValue)
```javascript
const o2sql = require('o2sql');
o2sql
  .select([
    'id',
    [
      o2sql.case({ country: 'CHN' }, o2sql.i('name'), o2sql.i('englishName')),
      'name',
    ],
  ])
  .from('user')
  .toParams();
```

## v4.0.11

1. uuid。

## v4.0.4

1. added: Symbol() of where now support expr/function/identifier
2. added: preserved system funciton name support, function name won't be wrapped with "". Now only EXISTS/NOT EXISTS (although they are not really funciton). More will be added soon.

## v4.0.3

1. Added: group option is now back. see o2sql-pg for usage.

## v4.0.2

1. Added: defaulTable support

## v4.0.0

1. Moved execution operations to o2sql-pg. o2sql now only focuses on sql generation.
2. Default export is changed to a class. This is different from versions <= v3. You need to change your code accordingly.

```javascript
// <= v3
const o2sql = require('o2sql');
o2sql.select(['id', 'name']).from('user').toParams();

// v4
const O2sql = require('o2sql');
const o2sql = new O2sql();
o2sql.select(['id', 'name']).from('user').toParams();
```

## v3.0.6

1. Added: multi datasources support

## v3.0.5

1. bug fixes
2. v3 doc

## v3.0.3

1. new: ignore limit when < 1.

## v3.0.2

1. added: returning support to _delete_

## v3.0.0 beta

Refactored all code

##v2.0.7

1. fixed: from now support subquery(o2sql.select())

## v2.0.6

1. fixed: join not working in count

## v2.0.5

1. fixed: count not working in update set

## v2.0.4

1. added: 'distinct' and select support to 'count'

## v2.0.3

1. &&, @>, <@ now support array with integer items

## v2.0.2

1. added '@>', '<@' support

## v2.0.1

1. WHERE: when value is null, =/<> will be parsed to IS/IS NOT

## v2.0.0

1. added indentifier support
2. added function support
3. added chaining .join() support
4. added where like object support to "on"

## v1.0.27

1. added 'union' support
2. added sub query support in 'from'
3. sub query now has its own mainTable.

## v1.0.26

1. new feature: support multiple \$or

```
...
.where({
  $or1: {
    a: 1,
    b: 2,
  },
  $or2: {
    c: 3,
    d: 4,
  },
})
...
```

```
WHERE (a = $4 OR b = $3) AND (c = $2 and d = $1)
```

## v1.0.22

1. fixed bug: mainTable not resolved in count()

## v1.0.21

1. fixed bugs.

## v1.0.20

1. add between support in where

```
....
.where({
  age: {
    between: [30, 50],
  },
})
...
```

## v1.0.19

1. add subquery support in select columns
