// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var findUsers = require('./helpers').findUsers;

exports.execute = function(app, alarmsModule, runningAlarm, action)
{
  var mailSender = app[alarmsModule.config.mailSenderId];

  if (!mailSender)
  {
    return alarmsModule.warn(
      "Cannot send emails: mailSender module not available!"
    );
  }

  findUsers(app, alarmsModule, runningAlarm, action, function(err, users)
  {
    if (runningAlarm.isStopped())
    {
      return;
    }

    if (err)
    {
      return alarmsModule.error(
        "Failed to retrieve users for email action %s: %s",
        runningAlarm.model.name,
        err.message
      );
    }

    var recipients = users
      .map(function(user) { return user.email; })
      .filter(function(email) { return email; })
      .join(', ');

    if (recipients.length === 0)
    {
      return alarmsModule.warn(
        "Not sending any e-mails: no recipients for action %d of alarm: %s",
        action.no,
        runningAlarm.model.name
      );
    }

    var subject = runningAlarm.model.name;
    var text = action.parameters.text;

    mailSender.send(recipients, subject, text, function(err)
    {
      if (runningAlarm.isStopped())
      {
        return;
      }

      if (err)
      {
        alarmsModule.error(
          "Failed to send email to %s as part of alarm %s: %s",
          recipients,
          runningAlarm.model.name,
          err.message
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
        alarmsModule.debug(
          "Sent email to %s with subject: %s", recipients, subject
        );

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
