const commands = require('./command');

const o2sqlFactory = options => {
  if (typeof options === 'string') {
    options = {
      command: options,
    };
  }
  Object.assign(
    {
      command: 'SELECT',
    },
    options
  );
  const command = options.command.toUpperCase();

  if (command in commands) {
    options.command = command;
  } else {
    options.name = options.command;
    options.command = 'IDENTIFIER';
  }

  return new commands[options.command](options);
};

o2sqlFactory.function = (name, ...args) => o2sqlFactory('function').call(name, ...args);
o2sqlFactory.f = o2sqlFactory.function;
o2sqlFactory.identifier = name => o2sqlFactory({
  command: 'IDENTIFIER',
  name,
});
o2sqlFactory.i = o2sqlFactory.identifier;
o2sqlFactory.select = columns => o2sqlFactory('SELECT').select(columns);
o2sqlFactory.count = table => o2sqlFactory({
  command: 'COUNT',
  [table instanceof Array ? 'columns' : 'from']: table,
});
o2sqlFactory.get = columns => o2sqlFactory('GET').select(columns);
o2sqlFactory.insert = values => o2sqlFactory('INSERT').values(values);
o2sqlFactory.insertInto = table => o2sqlFactory('INSERT').into(table);
o2sqlFactory.update = table => o2sqlFactory('UPDATE').table(table);
o2sqlFactory.delete = table => o2sqlFactory('DELETE').from(table);
o2sqlFactory.deleteFrom = o2sqlFactory.delete;

module.exports = o2sqlFactory;
