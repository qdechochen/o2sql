const commands = require('./command');

const o2sqlFactory = (options) => {
  if (typeof options === 'string') {
    options = {
      command: options,
    };
  }
  Object.assign({
    command: 'SELECT',
  }, options);

  options.command = options.command.toUpperCase();

  if (!(options.command in commands)) {
    throw new Error('Unsupported command');
  }

  return new commands[options.command](options);
};

o2sqlFactory.select = columns => o2sqlFactory('select').select(columns);
o2sqlFactory.count = table => o2sqlFactory('count').from(table);
o2sqlFactory.get = columns => o2sqlFactory('get').select(columns);
o2sqlFactory.insert = values => o2sqlFactory('insert').values(values);
o2sqlFactory.insertInto = table => o2sqlFactory('insert').into(table);
o2sqlFactory.update = table => o2sqlFactory('update').table(table);
o2sqlFactory.delete = table => o2sqlFactory('delete').from(table);
o2sqlFactory.deleteFrom = o2sqlFactory.delete;

module.exports = o2sqlFactory;
