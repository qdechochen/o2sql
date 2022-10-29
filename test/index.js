const o2sql = new (require('../index'))();

// let x = o2sql
//   .update('contact')
//   .set({
//     mainContact: false,
//   })
//   .where(3);

// console.dir(x, { depth: 8 });
// console.dir(x.toParams(), { depth: 8 });

const y = o2sql
  .select(['id'])
  .from('user')
  .where({
    [Symbol()]: {
      $left: o2sql.f('foo'),
      $op: '>=',
      $right: o2sql.i('age'),
    },
    [Symbol()]: {
      $op: 'EXISTS',
      $right: o2sql
        .select(['deptId'])
        .from('userDept')
        .where({
          userId: o2sql.i('user.deptId'),
        }),
    },
    [Symbol()]: {
      $right: o2sql.f(
        'NOT EXISTS',
        o2sql
          .select(['deptId'])
          .from('userDept')
          .where({
            userId: o2sql.i('user.deptId'),
          })
      ),
    },
    [Symbol()]: o2sql.f(
      'EXISTS',
      o2sql
        .select(['groupId'])
        .from('userGroup')
        .where({
          userId: o2sql.i('user.groupId'),
        })
    ),
    tags: {
      '&&': ['c'],
    },
  });
console.dir(y, { depth: 8 });
console.dir(y.toParams(), { depth: 8 });
