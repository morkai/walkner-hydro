// Part of <https://miracle.systems/p/walkner-furmon> licensed under <CC BY-NC-SA 4.0>

'use strict';

var setUpRoutes = require('./routes');

exports.DEFAULT_CONFIG = {
  mongooseId: 'mongoose',
  expressId: 'express',
  userId: 'user',
  mailSenderId: 'mail/sender'
};

exports.start = function startUsersModule(app, usersModule)
{
  app.onModuleReady(
    [
      usersModule.config.mongooseId,
      usersModule.config.userId,
      usersModule.config.expressId
    ],
    setUpRoutes.bind(null, app, usersModule)
  );
};
