// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var RunningAlarm = require('./RunningAlarm');

exports.DEFAULT_CONFIG = {
  controllerId: 'controller',
  messengerServerId: 'messenger/server',
  mongooseId: 'mongoose',
  mailSenderId: 'mail/sender',
  gammuId: 'gammu'
};

exports.start = function startAlarmsBackendModule(app, module)
{
  var mongoose = app[module.config.mongooseId];
  var controller = app[module.config.controllerId];

  if (!mongoose)
  {
    throw new Error("alarms module requires the mongoose module!");
  }

  if (!controller)
  {
    throw new Error("alarms module requires the controller module!");
  }

  app.onModuleReady(module.config.messengerServerId, setUpServerMessages);

  var Alarm = mongoose.model('Alarm');
  var runningAlarms = {};

  app.broker.subscribe('controller.tagValuesChanged', function(changes)
  {
    Object.keys(changes).forEach(function(tagName)
    {
      app.broker.publish('alarms.tagChanged.' + tagName);
    });
  });

  if (controller.tags.length === 0)
  {
    app.broker.subscribe('controller.tagValuesChanged', runAlarms).setLimit(1);
  }
  else
  {
    runAlarms();
  }

  /**
   * @private
   */
  function runAlarms()
  {
    Alarm.find({state: {$ne: Alarm.State.STOPPED}}, function(err, models)
    {
      if (err)
      {
        module.error("Failed to retrieve running alarms: %s", err.message);
      }
      else
      {
        models.forEach(function(model)
        {
          var runningAlarm = new RunningAlarm(app, module, model);

          runningAlarms[model.id] = runningAlarm;

          runningAlarm.checkConditions();
        });
      }
    });
  }

  /**
   * @private
   */
  function setUpServerMessages()
  {
    var messengerServer = app[module.config.messengerServerId];

    messengerServer.handle('alarms.added', handleAlarmAddedMessage);
    messengerServer.handle('alarms.edited', handleAlarmEditedMessage);
    messengerServer.handle('alarms.deleted', handleAlarmDeletedMessage);
    messengerServer.handle('alarms.run', handleAlarmRunMessage);
    messengerServer.handle('alarms.stop', handleAlarmStopMessage);
    messengerServer.handle('alarms.ack', handleAlarmAckMessage);
  }

  /**
   * @private
   * @param {object} message
   * @param {function} reply
   */
  function handleAlarmAddedMessage(message, reply)
  {
    handleAlarmRunMessage(message, reply);
  }

  /**
   * @private
   * @param {object} message
   * @param {function} reply
   */
  function handleAlarmEditedMessage(message, reply)
  {
    handleAlarmStopMessage(message, function(err)
    {
      if (err)
      {
        return reply(err);
      }

      handleAlarmRunMessage(message, reply);
    });
  }

  /**
   * @private
   * @param {object} message
   * @param {function} reply
   */
  function handleAlarmDeletedMessage(message, reply)
  {
    handleAlarmStopMessage(message, reply);
  }

  /**
   * @private
   * @param {object} message
   * @param {function} reply
   */
  function handleAlarmRunMessage(message, reply)
  {
    var alarmId = message.alarmId;
    var runningAlarm = runningAlarms[alarmId];

    if (runningAlarm)
    {
      return reply();
    }

    Alarm.findById(alarmId, function(err, model)
    {
      if (err)
      {
        return reply(err);
      }

      var runningAlarm = new RunningAlarm(app, module, model);

      runningAlarm.run(message.user, function(err)
      {
        if (err)
        {
          module.error(
            "Failed to run alarm %s: %s", runningAlarm.model.name, err.message
          );
        }
        else
        {
          runningAlarms[alarmId] = runningAlarm;

          module.debug("Alarm run: %s", runningAlarm.model.name);
        }

        reply(err);
      });
    });
  }

  /**
   * @private
   * @param {object} message
   * @param {function} reply
   */
  function handleAlarmStopMessage(message, reply)
  {
    var runningAlarm = runningAlarms[message.alarmId];

    if (!runningAlarm)
    {
      return reply();
    }

    runningAlarm.stop(message.user, function(err)
    {
      if (err)
      {
        module.error(
          "Failed to stop alarm %s: %s", runningAlarm.model.name, err.message
        );
      }
      else
      {
        delete runningAlarms[runningAlarm.model.id];

        module.info("Stopped alarm: %s", runningAlarm.model.name);

        runningAlarm.destroy();
      }

      reply(err);
    });
  }

  /**
   * @private
   * @param {object} message
   * @param {function} reply
   */
  function handleAlarmAckMessage(message, reply)
  {
    var runningAlarm = runningAlarms[message.alarmId];

    if (!runningAlarm)
    {
      return reply();
    }

    runningAlarm.ack(message.user, function(err)
    {
      if (err)
      {
        module.error(
          "Failed to acknowledge alarm %s: %s",
          runningAlarm.model.name,
          err.message
        );
      }
      else
      {
        module.info("Acknowledged alarm: %s", runningAlarm.model.name);
      }

      reply(err);
    });
  }
};
