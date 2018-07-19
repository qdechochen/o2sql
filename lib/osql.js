const commands = require('./command');

const osqlFactory = options => new commands[options.command](options);

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
