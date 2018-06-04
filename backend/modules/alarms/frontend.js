// Part of <https://miracle.systems/p/walkner-utilio> licensed under <CC BY-NC-SA 4.0>

'use strict';

const setUpAlarmsRoutes = require('./routes');

exports.DEFAULT_CONFIG = {
  mongooseId: 'mongoose',
  messengerClientId: 'messenger/client',
  expressId: 'express',
  userId: 'user',
  controllerId: 'controller'
};

exports.start = function startAlarmsFrontendModule(app, module)
{
  app.onModuleReady(
    [
      module.config.messengerClientId
    ],
    setUpAlarmsClientMessages
  );

  app.onModuleReady(
    [
      module.config.mongooseId,
      module.config.userId,
      module.config.expressId,
      module.config.controllerId,
      module.config.messengerClientId
    ],
    setUpAlarmsRoutes.bind(null, app, module)
  );

  /**
   * @param {string} alarmId
   * @param {?Object} user
   * @param {function(?Error)} done
   */
  module.ack = function(alarmId, user, done)
  {
    app[module.config.messengerClientId].request('alarms.ack', {alarmId: alarmId, user: user}, done);
  };

  /**
   * @param {string} alarmId
   * @param {?Object} user
   * @param {function(?Error)} done
   */
  module.run = function(alarmId, user, done)
  {
    app[module.config.messengerClientId].request('alarms.run', {alarmId: alarmId, user: user}, done);
  };

  /**
   * @param {string} alarmId
   * @param {?Object} user
   * @param {function(?Error)} done
   */
  module.stop = function(alarmId, user, done)
  {
    app[module.config.messengerClientId].request('alarms.stop', {alarmId: alarmId, user: user}, done);
  };

  function setUpAlarmsClientMessages()
  {
    ['alarms.added', 'alarms.edited', 'alarms.deleted'].forEach(function(topic)
    {
      app.broker.subscribe(topic, function(message)
      {
        app[module.config.messengerClientId].request(topic, {alarmId: message.model._id});
      });
    });
  }
};
