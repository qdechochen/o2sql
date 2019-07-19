const o2sql = require('../index');

const q = o2sql
.update('company')
.set({
  techCount: o2sql.count('tech').where({ companyId: 1 }),
})
.where(1)

console.dir(q.ast);
console.dir(q.toParams());
