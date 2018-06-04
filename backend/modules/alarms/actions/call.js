// Part of <https://miracle.systems/p/walkner-utilio> licensed under <CC BY-NC-SA 4.0>

'use strict';

const helpers = require('./helpers');

exports.execute = function(app, alarmsModule, runningAlarm, action)
{
  const twilio = app[alarmsModule.config.twilioId];

  if (!twilio)
  {
    return alarmsModule.warn('Cannot call: twilio module not available!');
  }

  helpers.findUsers(app, alarmsModule, runningAlarm, action, function(err, users)
  {
    if (runningAlarm.isStopped())
    {
      return;
    }

    const alarmName = runningAlarm.model.name;

    if (err)
    {
      return alarmsModule.error(`Failed to retrieve users for call action of alarm [${alarmName}]: ${err.message}`);
    }

    const currentDate = new Date();
    const currentTimeValue = currentDate.getHours() * 1000 + currentDate.getMinutes();
    const recipients = users
      .filter(user => helpers.filterSmsRecipient(currentTimeValue, user))
      .map(user => user.mobile);

    if (recipients.length === 0)
    {
      return alarmsModule.warn(`Not calling: no recipients for action [${action.no}] of alarm: ${alarmName}`);
    }

    recipients.forEach(recipient => sayToRecipient(recipient, action));
  });

  function sayToRecipient(recipient, action)
  {
    const alarmName = runningAlarm.model.name;
    const sayOptions = {
      to: recipient,
      message: action.parameters.text,
      voice: 'alice',
      language: 'pl-PL'
    };

    twilio.say(sayOptions, function(err)
    {
      if (err)
      {
        alarmsModule.error(`Failed to call to [${recipient}] as part of alarm [${alarmName}]: ${err.message}`);

        app.broker.publish('alarms.actions.callFailed', {
          model: runningAlarm.toJSON(),
          action: {
            no: action.no,
            type: action.type
          },
          error: err.toJSON(),
          recipient: recipient
        });
      }
      else
      {
        alarmsModule.debug(`Called as part of alarm [${alarmName}] to: ${recipient}`);

        app.broker.publish('alarms.actions.called', {
          model: runningAlarm.toJSON(),
          action: {
            no: action.no,
            type: action.type
          },
          recipient: recipient
        });
      }
    });
  }
};
