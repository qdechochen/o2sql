const o2sql = require('../index');

const q = o2sql.select(['keyword', [o2sql.parse('count(id)'), 'count']]).from('keyword').where({
  d: {
    BETWEEN: [2, 3]
  },
  e: [4, 5]
}).groupby(['keyword'])
  .orderby(['-count']);
console.dir(q.toParams());
