const o2sql = require('../index');


const o = o2sql.select(['id', 'gender', ['name', 'userName'], ['age', 'userAge', 'int'], [o2sql.select(['id']).from('anotherTable').where({
  id: 1,
  a: 2,
  $$1: {
    left: o2sql.parse('udb.mobile'),
    op: 'ILIKE',
    right: o2sql.parse('concat(\'%\', "user"."mobile", \'%\')')
  }
}), 'subQuery']])
  .from('user')
  .where({
    b: 3
  });

console.log(JSON.stringify(o.ast, 2, 2));
console.dir(o.toParams());
