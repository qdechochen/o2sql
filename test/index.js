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
  .select([
    'id',
    'name',
    {
      table: 'dept',
      fields: ['id', 'name'],
      prefix: 'dept',
      group: true,
    },
  ])
  .from('user')
  .innerJoin('dept', ['deptId', 'dept.id'])
  .default('user')
  .where({
    orgId: 3,
  })
  .orderby(['deptName']);
console.dir(y, { depth: 8 });
console.dir(y.toParams(), { depth: 8 });
