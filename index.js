const o2ast = require('./lib/o2ast');

const o2sqlFactory = opts => {};

o2sqlFactory.function = (name, ...args) => o2ast.function(name, ...args);
o2sqlFactory.f = o2sqlFactory.function;
