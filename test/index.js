const o2sql = require('../index');

console.log(o2sql.update('user')
  .set({
    name: 'Echo',
    age: 34,
    count: o2sql.parse('"count" + 1'),
    likes: o2sql.count('ul').where({
      tt: 3,
    })
  })
  .where({
    $or: {
      id: 1,
      name: '3',
    },
    id: 1,
  }).toParams());
