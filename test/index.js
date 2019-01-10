const o2sql = require('../index');

const o = o2sql.select(['id', 'group', 'name'])
  .from('user')
  .distinct(['id', 'group']);

console.log(JSON.stringify(o.ast, 2, 2));
console.dir(o.toParams());
