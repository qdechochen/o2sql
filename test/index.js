const o2sql = require('../index');

const q = o2sql
  .select(['id', 'name'])
  .from('user')
  .join('group', {
    'user.groupId': o2sql('group.id'),
  })
  .leftJoin('dept', {
    'user.kind': 'normal',
    $$: {
      left: o2sql('user.gid'),
      op: '=',
      right: o2sql('group.id'),
    },
  }, true)
  .rightJoin('organization', ['orgId', 'id'])
  .where(3)

console.dir(q.ast);
console.dir(q.toParams());

