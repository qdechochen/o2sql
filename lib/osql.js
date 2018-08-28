const commands = require('./command');

const osqlFactory = options => new commands[options.command](options);

osqlFactory.select = columns => osqlFactory('select').select(columns);
osqlFactory.count = table => osqlFactory('count').from(table);
osqlFactory.get = columns => osqlFactory('get').select(columns);
osqlFactory.insert = table => osqlFactory('insert').into(table);
osqlFactory.update = table => osqlFactory('update').table(table);
osqlFactory.delete = table => osqlFactory('delete').from(table);

module.exports = (options) => {
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

  return osqlFactory(options);
};
