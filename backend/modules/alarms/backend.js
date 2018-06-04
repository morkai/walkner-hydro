// Part of <https://miracle.systems/p/walkner-utilio> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const RunningAlarm = require('./RunningAlarm');

exports.DEFAULT_CONFIG = {
  controllerId: 'controller',
  messengerServerId: 'messenger/server',
  mongooseId: 'mongoose',
  mailSenderId: 'mail/sender',
  smsSenderId: 'sms/sender',
  twilioId: 'twilio'
};

exports.start = function startAlarmsBackendModule(app, module)
{
  const mongoose = app[module.config.mongooseId];

  if (!mongoose)
  {
    throw new Error('alarms module requires the mongoose module!');
  }

  const Alarm = mongoose.model('Alarm');
  const runningAlarms = {};

  app.onModuleReady(module.config.messengerServerId, setUpServerMessages);

  app.onModuleReady(module.config.controllerId, function()
  {
    if (app[module.config.controllerId].tags.length === 0)
    {
      app.broker.subscribe('controller.tagValuesChanged', runAlarms).setLimit(1);
    }
    else
    {
      runAlarms();
    }
  });

  app.broker.subscribe('controller.tagValuesChanged', function(changes)
  {
    _.forEach(changes, (unused, tagName) => { app.broker.publish(`alarms.tagChanged.${tagName}`); });
  });

  /**
   * @private
   */
  function runAlarms()
  {
    Alarm.find({state: {$ne: Alarm.State.STOPPED}}, function(err, models)
    {
      if (err)
      {
        module.error(`Failed to retrieve running alarms: ${err.message}`);
      }
      else
      {
        _.forEach(models, function(model)
        {
          const runningAlarm = new RunningAlarm(app, module, model);

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
    const messengerServer = app[module.config.messengerServerId];

    messengerServer.handle('alarms.added', handleAlarmAddedMessage);
    messengerServer.handle('alarms.edited', handleAlarmEditedMessage);
    messengerServer.handle('alarms.deleted', handleAlarmDeletedMessage);
    messengerServer.handle('alarms.run', handleAlarmRunMessage);
    messengerServer.handle('alarms.stop', handleAlarmStopMessage);
    messengerServer.handle('alarms.ack', handleAlarmAckMessage);
  }

  /**
   * @private
   * @param {Object} message
   * @param {function} reply
   */
  function handleAlarmAddedMessage(message, reply)
  {
    handleAlarmRunMessage(message, reply);
  }

  /**
   * @private
   * @param {Object} message
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
   * @param {Object} message
   * @param {function} reply
   */
  function handleAlarmDeletedMessage(message, reply)
  {
    handleAlarmStopMessage(message, reply);
  }

  /**
   * @private
   * @param {Object} message
   * @param {function} reply
   * @returns {undefined}
   */
  function handleAlarmRunMessage(message, reply)
  {
    const alarmId = message.alarmId;

    if (runningAlarms[alarmId])
    {
      return reply();
    }

    Alarm.findById(alarmId, function(err, model)
    {
      if (err)
      {
        return reply(err);
      }

      const runningAlarm = new RunningAlarm(app, module, model);

      runningAlarm.run(message.user, function(err)
      {
        if (err)
        {
          module.error(`Failed to run alarm [${runningAlarm.model.name}]: ${err.message}`);
        }
        else
        {
          runningAlarms[alarmId] = runningAlarm;

          module.info(`Alarm run: ${runningAlarm.model.name}`);
        }

        reply(err);
      });
    });
  }

  /**
   * @private
   * @param {Object} message
   * @param {function} reply
   * @returns {undefined}
   */
  function handleAlarmStopMessage(message, reply)
  {
    const runningAlarm = runningAlarms[message.alarmId];

    if (!runningAlarm)
    {
      return reply();
    }

    runningAlarm.stop(message.user, function(err)
    {
      if (err)
      {
        module.error(`Failed to stop alarm [${runningAlarm.model.name}]: ${err.message}`);
      }
      else
      {
        delete runningAlarms[runningAlarm.model.id];

        module.info(`Stopped alarm: ${runningAlarm.model.name}`);

        runningAlarm.destroy();
      }

      reply(err);
    });
  }

  /**
   * @private
   * @param {Object} message
   * @param {function} reply
   * @returns {undefined}
   */
  function handleAlarmAckMessage(message, reply)
  {
    const runningAlarm = runningAlarms[message.alarmId];

    if (!runningAlarm)
    {
      return reply();
    }

    runningAlarm.ack(message.user, function(err)
    {
      if (err)
      {
        module.error(`Failed to acknowledge alarm [${runningAlarm.model.name}]: ${err.message}`);
      }
      else
      {
        module.info(`Acknowledged alarm: ${runningAlarm.model.name}`);
      }

      reply(err);
    });
  }
};
