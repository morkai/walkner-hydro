'use strict';

var setUpAlarmsRoutes = require('./routes');

exports.DEFAULT_CONFIG = {
  mongooseId: 'mongoose',
  messengerClientId: 'messenger/client',
  expressId: 'express',
  userId: 'user',
  controllerId: 'controller'
};

exports.start = function startAlarmsFrontendModule(app, module)
{
  var messengerClient = app[module.config.messengerClientId];

  if (!messengerClient)
  {
    throw new Error(
      "alarms/frontend module requires the messenger/client module!"
    );
  }

  setUpAlarmsClientMessages();

  app.onModuleReady(
    [
      module.config.mongooseId,
      module.config.userId,
      module.config.expressId,
      module.config.controllerId
    ],
    setUpAlarmsRoutes.bind(null, app, module)
  );

  /**
   * @param {string} alarmId
   * @param {object|null} user
   * @param {function(Error|null)} done
   */
  module.ack = function(alarmId, user, done)
  {
    messengerClient.request(
      'alarms.ack', {alarmId: alarmId, user: user}, done
    );
  };

  /**
   * @param {string} alarmId
   * @param {object|null} user
   * @param {function(Error|null)} done
   */
  module.run = function(alarmId, user, done)
  {
    messengerClient.request(
      'alarms.run', {alarmId: alarmId, user: user}, done
    );
  };

  /**
   * @param {string} alarmId
   * @param {object|null} user
   * @param {function(Error|null)} done
   */
  module.stop = function(alarmId, user, done)
  {
    messengerClient.request(
      'alarms.stop', {alarmId: alarmId, user: user}, done
    );
  };

  function setUpAlarmsClientMessages()
  {
    ['alarms.added', 'alarms.edited', 'alarms.deleted'].forEach(function(topic)
    {
      app.broker.subscribe(topic, function(message)
      {
        messengerClient.request(topic, {alarmId: message.model._id});
      });
    });
  }
};
