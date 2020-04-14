const o2sql = new (require('../index'))();

// let x = o2sql
//   .update('contact')
//   .set({
//     mainContact: false,
//   })
//   .where(3);

// console.dir(x, { depth: 8 });
// console.dir(x.toParams(), { depth: 8 });

const y = o2sql.delete('user').where(2);
console.dir(y, { depth: 8 });
console.dir(y.toParams(), { depth: 8 });
