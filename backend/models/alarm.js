'use strict';

var lodash = require('lodash');

module.exports = function setupAlarmModel(app, mongoose)
{
  /**
   * @enum {number}
   */
  var AlarmState = {
    STOPPED: 0,
    RUNNING: 1,
    ACTIVE: 2
  };

  /**
   * @enum {string}
   */
  var AlarmStopConditionMode = {
    MANUAL: 'manual',
    NEGATED: 'negated',
    SPECIFIED: 'specified'
  };

  /**
   * @enum {string}
   */
  var AlarmSeverity = {
    DEBUG: 'debug',
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
  };

  var actionSchema = mongoose.Schema({
    type: {
      type: String,
      enum: ['sms', 'email', 'severity'],
      required: true
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed
    },
    delay: {
      type: Number,
      min: 0,
      max: 3600 * 24,
      default: 0
    },
    severity: {
      type: String,
      enum: lodash.values(AlarmSeverity),
      default: AlarmSeverity.WARNING
    }
  });

  var alarmSchema = mongoose.Schema({
    name: {
      type: String,
      trim: true,
      required: true
    },
    state: {
      type: Number,
      min: 0,
      max: 2,
      default: AlarmState.STOPPED
    },
    lastStateChangeTime: {
      type: Number,
      min: 0,
      default: 0
    },
    startCondition: {
      type: String
    },
    startConditionTags: [String],
    startFunction: {
      type: String,
      default: ''
    },
    startActions: [actionSchema],
    stopConditionMode: {
      type: String,
      enum: lodash.values(AlarmStopConditionMode)
    },
    stopCondition: {
      type: String
    },
    stopConditionTags: [String],
    stopFunction: {
      type: String,
      default: ''
    },
    stopActions: [actionSchema]
  }, {
    toJSON: {
      virtuals: true,
      transform: function(alarm, ret)
      {
        ret._id = ret.id;

        delete ret.id;
        delete ret.startFunction;
        delete ret.stopFunction;

        return ret;
      }
    }
  });

  alarmSchema.pre('save', function(next)
  {
    if (this.isDirectModified('state'))
    {
      this.lastStateChangeTime = Date.now();
    }

    next();
  });

  alarmSchema.statics.State = AlarmState;

  alarmSchema.statics.StopConditionMode = AlarmStopConditionMode;

  /**
   * @param {object.<string, *>} leanAlarm
   * @param {object.<string, boolean>} fields
   * @returns {object}
   */
  alarmSchema.statics.customizeLeanObject = function(leanAlarm, fields)
  {
    if (fields.actionIndex || fields.severity)
    {
      var actionIndex = getCurrentActionIndex(leanAlarm);

      if (fields.actionIndex)
      {
        leanAlarm.actionIndex = actionIndex;
      }

      if (fields.severity)
      {
        leanAlarm.severity = getCurrentSeverity(leanAlarm, actionIndex);
      }
    }

    return leanAlarm;
  };

  alarmSchema.virtual('actionIndex').get(function()
  {
    return getCurrentActionIndex(this);
  });

  alarmSchema.virtual('severity').get(function()
  {
    return getCurrentSeverity(this, getCurrentActionIndex(this));
  });

  /**
   * @param {number} startConditionMetAt
   * @returns {number}
   */
  alarmSchema.methods.getCurrentStartActionIndex = function(startConditionMetAt)
  {
    var currentActionIndex = -1;
    var startActions = this.startActions;
    var timeDiff = Date.now() - startConditionMetAt;
    var timeSum = 0;

    for (var i = 0; i < startActions.length; ++i)
    {
      timeSum += startActions[i].delay * 1000;

      if (timeDiff < timeSum)
      {
        break;
      }

      currentActionIndex = i;
    }

    return currentActionIndex;
  };

  /**
   * @param {number} actionIndex
   * @param {number} startConditionMetAt
   * @returns {number}
   */
  alarmSchema.methods.getStartActionExecutionTime =
    function(actionIndex, startConditionMetAt)
  {
    if (actionIndex < 0 || actionIndex >= this.startActions.length)
    {
      return -1;
    }

    var executionTime = startConditionMetAt;

    for (var i = 0; i <= actionIndex; ++i)
    {
      executionTime += this.startActions[i].delay * 1000;
    }

    return executionTime;
  };

  /**
   * @returns {boolean}
   */
  alarmSchema.methods.isStopped = function()
  {
    return this.state === AlarmState.STOPPED;
  };

  /**
   * @returns {boolean}
   */
  alarmSchema.methods.isRunning = function()
  {
    return this.state === AlarmState.RUNNING;
  };

  /**
   * @returns {boolean}
   */
  alarmSchema.methods.isActive = function()
  {
    return this.state === AlarmState.ACTIVE;
  };

  /**
   * @returns {boolean}
   */
  alarmSchema.methods.isManualStop = function()
  {
    return this.stopConditionMode === AlarmStopConditionMode.MANUAL;
  };

  /**
   * @returns {boolean}
   */
  alarmSchema.methods.isNegatedStop = function()
  {
    return this.stopConditionMode === AlarmStopConditionMode.NEGATED;
  };

  /**
   * @returns {boolean}
   */
  alarmSchema.methods.isSpecifiedStop = function()
  {
    return this.stopConditionMode === AlarmStopConditionMode.SPECIFIED;
  };

  mongoose.model('Alarm', alarmSchema);

  /**
   * @private
   * @param {object} alarm
   * @returns {number}
   */
  function getCurrentActionIndex(alarm)
  {
    if (alarm.state !== AlarmState.ACTIVE
      || typeof alarm.lastStateChangeTime !== 'number')
    {
      return -1;
    }

    var startActions = alarm.startActions;

    if (!Array.isArray(startActions) || startActions.length === 0)
    {
      return -1;
    }

    var timeDiff = Date.now() - alarm.lastStateChangeTime;
    var timeSum = 0;

    for (var i = 0; i < startActions.length; ++i)
    {
      timeSum += startActions[i].delay * 1000;

      if (timeDiff < timeSum)
      {
        return i;
      }
    }

    return startActions.length - 1;
  }

  /**
   * @private
   * @param {object} alarm
   * @param {number} actionIndex
   * @returns {string|null}
   */
  function getCurrentSeverity(alarm, actionIndex)
  {
    return actionIndex === -1
      ? (alarm.state === AlarmState.ACTIVE ? 'debug' : null)
      : alarm.startActions[actionIndex].severity;
  }
};
