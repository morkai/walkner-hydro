// Part of <https://miracle.systems/p/walkner-utilio> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const ObjectID = require('mongodb').ObjectID;

/**
 * @param {Object} app
 * @param {Object} alarmsModule
 * @param {Object} runningAlarm
 * @param {Object} action
 * @param {function(?Error, ?Array<Object>)} done
 * @returns {undefined}
 */
exports.findUsers = function(app, alarmsModule, runningAlarm, action, done)
{
  let userIds = Array.isArray(action.parameters.users) ? action.parameters.users : [];

  userIds = userIds
    .map(user =>
    {
      try
      {
        return ObjectID.createFromHexString(user.id);
      }
      catch (err)
      {
        return null;
      }
    })
    .filter(userId => userId !== null);

  if (userIds.length === 0)
  {
    return done(null, userIds);
  }

  const User = app[alarmsModule.config.mongooseId].model('User');
  const condition = {_id: {$in: userIds}};
  const fields = {login: 1, mobile: 1, email: 1};
  const options = {lean: true};

  User.find(condition, fields, options, function(err, users)
  {
    if (err)
    {
      app.broker.publish('alarms.actions.findUsersFailed', {
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

/**
 * @param {?number} currentTimeValue
 * @param {{mobile: Array<Object>}} user
 * @returns {boolean}
 */
exports.filterSmsRecipient = function(currentTimeValue, user)
{
  if (currentTimeValue == null)
  {
    const currentDate = new Date();

    currentTimeValue = currentDate.getHours() * 1000 + currentDate.getMinutes();
  }

  return _.some(user.mobile, function(mobile)
  {
    var match = true;
    var fromTime = parseMobileTime(mobile.fromTime);
    var toTime = parseMobileTime(mobile.toTime === '00:00' ? '24:00' : mobile.toTime);

    if (toTime.value < fromTime.value)
    {
      match = currentTimeValue < toTime.value || currentTimeValue >= fromTime.value;
    }
    else if (fromTime.value < toTime.value)
    {
      match = currentTimeValue >= fromTime.value && currentTimeValue < toTime.value;
    }

    if (match)
    {
      user.mobile = mobile.number;
    }

    return match;
  });
};

function parseMobileTime(time)
{
  var parts = time.split(':');
  var hours = parseInt(parts[0], 10);
  var minutes = parseInt(parts[1], 10);

  return {
    hours: hours,
    minutes: minutes,
    value: hours * 1000 + minutes
  };
}
