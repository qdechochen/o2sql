const o2sql = require('../index');

const q = o2sql.select(
  ['id']).from({
  left: {
    name: 'talk',
    key: 'companyId',
    main: true,
  },
  right: {
    name: 'company',
    key: 'id',
  },
}).where({
  status: 'pnd',
});
console.dir(q.toParams());
