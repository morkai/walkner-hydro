'use strict';

var lodash = require('lodash');

exports.DEFAULT_CONFIG = {
  messengerClientId: 'messenger/client',
  sioId: 'sio',
  operatorIps: ['127.0.0.1'],
  stopPassword: '!23'
};

exports.start = function startBreakinFrontendModule(app, module)
{
  var messengerClient = app[module.config.messengerClientId];

  if (!messengerClient)
  {
    throw new Error("breakin module requires the messenger/client module!");
  }

  app.onModuleReady(module.config.sioId, setUpSioModule);

  app.broker.subscribe('users.login', function(message)
  {
    var user = message.user;

    if (isOperator(user.ipAddress))
    {
      messengerClient.request('breakin.operatorLoggedIn', {state: true});
    }

    if (!lodash.isObject(user)
      || !lodash.isString(user.ipAddress)
      || !lodash.isArray(user.privileges)
      || user.privileges.indexOf('ALARMS_BREAKIN') === -1
      || user.local !== true)
    {
      return;
    }

    stopAlarm();
  });

  app.broker.subscribe('users.logout', function(message)
  {
    var user = message.user;

    if (isOperator(user.ipAddress))
    {
      messengerClient.request('breakin.operatorLoggedIn', {state: false});
    }
  });

  /**
   * @private
   */
  function setUpSioModule()
  {
    var sockets = app[module.config.sioId].sockets;

    sockets.on('connection', function(socket)
    {
      socket.on('breakin.stopAlarm', function(code, reply)
      {
        if (code === module.config.stopPassword)
        {
          stopAlarm(reply);
        }
        else
        {
          setTimeout(reply, 1000);
        }
      });
    });
  }

  /**
   * @private
   * @param {function} [done]
   */
  function stopAlarm(done)
  {
    messengerClient.request('breakin.stopAlarm', null, done);
  }

  /**
   * @private
   * @param {string} ipAddress
   * @returns {boolean}
   */
  function isOperator(ipAddress)
  {
    return module.config.operatorIps.indexOf(ipAddress) !== -1;
  }
};
