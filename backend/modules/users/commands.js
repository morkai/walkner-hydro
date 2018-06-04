// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');

module.exports = function setUpUsersCommands(app, usersModule)
{
  const sio = app[usersModule.config.sioId];

  sio.sockets.on('connection', function(socket)
  {
    socket.on('users.sync', handleUsersSyncRequest.bind(null, socket));
  });

  function handleUsersSyncRequest(socket, reply)
  {
    if (!_.isFunction(reply))
    {
      reply = function() {};
    }

    if (usersModule.syncing)
    {
      return reply();
    }

    const user = socket.handshake.user || {privileges: []};

    if (!user.super && user.privileges.indexOf('USERS:MANAGE') === -1)
    {
      return reply(new Error('AUTH'));
    }

    reply();

    usersModule.syncUsers(user);
  }
};
