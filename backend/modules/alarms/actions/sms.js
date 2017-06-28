// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var transliterate = require('transliteration').transliterate;
var findUsers = require('./helpers').findUsers;

exports.execute = function(app, alarmsModule, runningAlarm, action)
{
  var gammu = app[alarmsModule.config.gammuId];

  if (!gammu)
  {
    return alarmsModule.warn(
      "Cannot send SMS: gammu module not available!"
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
        "Failed to retrieve users for sms action of alarm %s: %s",
        runningAlarm.model.name,
        err.message
      );
    }

    if (users.length === 0)
    {
      return alarmsModule.warn(
        "Not sending any SMS: no recipients for action %d of alarm: %s",
        action.no,
        runningAlarm.model.name
      );
    }

    var text;

    try
    {
      text = transliterate(action.parameters.text);
    }
    catch (err)
    {
      text = action.parameters.text;
    }

    users.forEach(function(user)
    {
      gammu.sendText(user.mobile, text, function(err)
      {
        if (runningAlarm.isStopped())
        {
          return;
        }

        if (err)
        {
          alarmsModule.error(
            "Failed to send SMS to %s (%s) as part of alarm %s: %s",
            user.login,
            user.mobile,
            runningAlarm.model.name,
            err.message
          );

          app.broker.publish('alarms.actions.smsFailed', {
            model: runningAlarm.toJSON(),
            action: {
              no: action.no,
              type: action.type
            },
            error: err.toJSON(),
            recipient: {
              _id: user._id,
              login: user.login,
              mobile: user.mobile
            }
          });
        }
        else
        {
          alarmsModule.debug(
            "Sent SMS to %s (%s) as part of alarm %s",
            user.login,
            user.mobile,
            runningAlarm.model.name
          );

          app.broker.publish('alarms.actions.smsSent', {
            model: runningAlarm.toJSON(),
            action: {
              no: action.no,
              type: action.type
            },
            recipient: {
              _id: user._id,
              login: user.login,
              mobile: user.mobile
            }
          });
        }
      });
    });
  });
};
