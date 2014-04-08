// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

/*jshint maxparams:5*/

'use strict';

var ObjectID = require('mongodb').ObjectID;

/**
 * @param {object} app
 * @param {object} alarmsModule
 * @param {object} runningAlarm
 * @param {object} action
 * @param {function(Error|null, Array.<object>|null)} done
 */
exports.findUsers = function(app, alarmsModule, runningAlarm, action, done)
{
  var userIds = Array.isArray(action.parameters.users)
    ? action.parameters.users
    : [];

  userIds = userIds
    .map(function(userId)
    {
      try
      {
        return ObjectID.createFromHexString(userId);
      }
      catch (err)
      {
        return null;
      }
    })
    .filter(function(userId)
    {
      return userId !== null;
    });

  if (userIds.length === 0)
  {
    return done(null, userIds);
  }

  var User = app[alarmsModule.config.mongooseId].model('User');
  var condition = {_id: {$in: userIds}};
  var fields = {login: 1, mobile: 1, email: 1};
  var options = {lean: true};

  User.find(condition, fields, options, function(err, users)
  {
    if (err)
    {
      app.broker.publish('alarms.actions.usersFindFailed', {
        model: runningAlarm.toJSON(),
        action: {
          no: action.no,
          type: action.type
        }
      });
    }

    done(err, users);
  });
};
