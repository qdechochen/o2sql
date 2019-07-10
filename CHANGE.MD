# CHANGE LOG

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
1. new feature: support multiple $or
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
