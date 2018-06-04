// Part of <https://miracle.systems/p/walkner-utilio> licensed under <CC BY-NC-SA 4.0>

'use strict';

const findUsers = require('./helpers').findUsers;

exports.execute = function(app, alarmsModule, runningAlarm, action)
{
  const mailSender = app[alarmsModule.config.mailSenderId];

  if (!mailSender)
  {
    return alarmsModule.warn('Cannot send emails: mailSender module not available!');
  }

  findUsers(app, alarmsModule, runningAlarm, action, function(err, users)
  {
    if (runningAlarm.isStopped())
    {
      return;
    }

    const subject = runningAlarm.model.name;

    if (err)
    {
      return alarmsModule.error(`Failed to retrieve users for email action [${subject}]: ${err.message}`);
    }

    const recipients = users
      .map(user => user.email)
      .filter(email => !!email);

    if (recipients.length === 0)
    {
      return alarmsModule.warn(`Not sending any e-mails: no recipients for action [${action.no}] of alarm: ${subject}`);
    }

    const text = action.parameters.text;

    mailSender.send(recipients, subject, text, function(err)
    {
      if (runningAlarm.isStopped())
      {
        return;
      }

      if (err)
      {
        alarmsModule.error(
          `Failed to send email to [${recipients.join('; ')}] as part of alarm [${subject}]: ${err.message}`
        );

        app.broker.publish('alarms.actions.emailFailed', {
          model: runningAlarm.toJSON(),
          action: {
            no: action.no,
            type: action.type
          },
          error: err.toJSON(),
          recipients: recipients
        });
      }
      else
      {
        alarmsModule.debug(`Sent email to [${recipients.join('; ')}] with subject: ${subject}`);

        app.broker.publish('alarms.actions.emailSent', {
          model: runningAlarm.toJSON(),
          action: {
            no: action.no,
            type: action.type
          },
          recipients: recipients
        });
      }
    });
  });
};
