const { SlackUser, Channel } = require('./models');
const {
  CurrentUserMessage, SignInMessage, SubscribedMessage, ErrorMessage, SubscriptionListMessage,
} = require('./messages');

module.exports = (robot) => {
  const middleware = {
    authenticate: async (command, next) => {
      // eslint-disable-next-line no-param-reassign
      command.user = await SlackUser.lookup(command);
      return next();
    },

    requireGitHubUser: (command, next) => (
      !command.user || !command.user.GitHubUser ? next('signin') : next()
    ),
  };

  robot.commands.use(middleware.authenticate);

  robot.commands.on('signin', async (command) => {
    const message = command.user ?
      new CurrentUserMessage(command.user) :
      new SignInMessage(command);

    return command.respond(message);
  }).description('Connect your GitHub account');

  robot.commands.on(
    'subscribe',
    middleware.requireGitHubUser,
    async (command) => {
      const channel = await Channel.lookup(command);
      const user = await SlackUser.lookup(command);

      if (!user) {
        return robot.invoke('signin', command);
      }

      try {
        const subscription = await channel.subscribe(command);

        return command.respond(new SubscribedMessage(subscription));
      } catch (err) {
        return command.respond(new ErrorMessage(err));
      }
    },
  ).usage('subscribe owner/repository [features]')
    .description('Subscribe to notifications for a repository');


  robot.commands.on(
    'unsubscribe',
    middleware.requireGitHubUser,
    async (command) => {
      const channel = await Channel.lookup(command);
      const settings = command.args.slice(1);

      if (!command.user) {
        return robot.invoke('signin', command);
      }

      if (settings) {
        channel.updateSettings({
          resource: command.args[0],
          settings,
        });
      } else {
        const subscription = await channel.unsubscribe(command);

        return command.respond(new SubscribedMessage(subscription));
      }
    },
  )
    .usage('unsubscribe owner/repository [features]')
    .description('Unsubscribe to notifications for a repository');


  robot.commands.on('list', async (command) => {
    const channel = new Channel(command);

    const subscriptions = await channel.subscriptions();
    return command.respond(new SubscriptionListMessage(subscriptions));
  })
    .usage('subscribe list')
    .description('List all active subscriptions in a channel');

  robot.commands.on('error', (err, command) => {
    command.respond(new ErrorMessage(err));
  });
};
