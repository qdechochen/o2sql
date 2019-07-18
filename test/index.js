const o2sql = require('../index');

const q = o2sql
.count('user')
.select(['companyId'])
.where({
  groupd: 1,
})
.distinct();

console.dir(q.ast);
console.dir(q.toParams());
