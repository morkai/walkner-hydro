// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var actions = require('./actions');

module.exports = RunningAlarm;

/**
 * @constructor
 * @param {object} app
 * @param {object} alarmsModule
 * @param {Alarm} model
 */
function RunningAlarm(app, alarmsModule, model)
{
  /**
   * @private
   * @type {object}
   */
  this.app = app;

  /**
   * @private
   * @type {object}
   */
  this.alarmsModule = alarmsModule;

  /**
   * @private
   * @type {object}
   */
  this.controller = app[alarmsModule.config.controllerId];

  /**
   * @private
   * @type {h5.pubsub.Broker}
   */
  this.broker = app.broker.sandbox();

  /**
   * @type {Alarm}
   */
  this.model = model;

  /**
   * @private
   * @type {function}
   */
  this.Alarm = model.constructor;

  /**
   * @private
   * @type {boolean}
   */
  this.checkingConditions = false;

  /**
   * @private
   * @type {function}
   */
  this.doConditionCheck = this.doConditionCheck.bind(this);

  /**
   * @private
   * @type {function(object)|null}
   */
  this.startConditionFunction = null;

  /**
   * @private
   * @type {function(object)|null}
   */
  this.stopConditionFunction = null;

  /**
   * @private
   * @type {*}
   */
  this.nextStartActionTimer = null;

  /**
   * @private
   * @type {number}
   */
  this.currentActionIndex = -1;

  /**
   * @private
   * @type {number}
   */
  this.startConditionMetAt = -1;

  this.compileConditionFunctions();
  this.watchTagValues();
}

RunningAlarm.prototype.destroy = function()
{
  this.broker.destroy();
  this.broker = null;

  clearTimeout(this.nextStartActionTimer);
  this.nextStartActionTimer = null;

  this.app = null;
  this.alarmsModule = null;
  this.model = null;
  this.Alarm = null;
};

RunningAlarm.prototype.toJSON = function()
{
  return {
    _id: this.model.id,
    name: this.model.name
  };
};

/**
 * @returns {boolean}
 */
RunningAlarm.prototype.isStopped = function()
{
  return !this.model || this.model.isStopped();
};

RunningAlarm.prototype.run = function(user, done)
{
  if (!this.model.isStopped())
  {
    return done();
  }

  this.model.state = this.Alarm.State.RUNNING;

  var runningAlarm = this;

  this.model.save(function(err)
  {
    if (err)
    {
      return done(err);
    }

    runningAlarm.broker.publish('alarms.run', {
      user: user,
      model: runningAlarm.toJSON()
    });

    done();

    runningAlarm.checkConditions();
  });
};

RunningAlarm.prototype.stop = function(user, done)
{
  if (this.model.isStopped())
  {
    return done();
  }

  this.model.state = this.Alarm.State.STOPPED;

  clearTimeout(this.nextStartActionTimer);
  this.nextStartActionTimer = null;

  var runningAlarm = this;

  this.model.save(function(err)
  {
    if (err)
    {
      return done(err);
    }

    runningAlarm.broker.publish('alarms.stopped', {
      user: user,
      model: runningAlarm.toJSON()
    });

    done();
  });
};

RunningAlarm.prototype.ack = function(user, done)
{
  if (!this.model.isActive() || !this.model.isManualStop())
  {
    return done();
  }

  if (this.checkStartCondition())
  {
    return done(new Error('START_CONDITION_MET'));
  }

  this.deactivate(user, done);
};

RunningAlarm.prototype.checkConditions = function()
{
  if (this.checkingConditions)
  {
    return;
  }

  this.checkingConditions = true;

  setImmediate(this.doConditionCheck);
};

/**
 * @private
 */
RunningAlarm.prototype.doConditionCheck = function()
{
  this.checkingConditions = false;

  if (this.model.isStopped())
  {
    return;
  }

  if (this.model.isRunning())
  {
    if (this.checkStartCondition())
    {
      if (this.startConditionMetAt === -1)
      {
        this.startConditionMetAt = Date.now();
      }

      this.executeNextStartAction();
    }
    else
    {
      this.startConditionMetAt = -1;
    }

    return;
  }

  if (this.model.isActive())
  {
    if (this.checkStopCondition())
    {
      this.startConditionMetAt = -1;

      this.deactivate();
    }
    else if (this.checkStartCondition())
    {
      if (this.startConditionMetAt === -1)
      {
        this.startConditionMetAt = this.model.lastStateChangeTime;
      }

      this.executeNextStartAction();
    }
    else
    {
      this.startConditionMetAt = -1;
    }
  }
};

/**
 * @private
 * @param {number} time
 */
RunningAlarm.prototype.scheduleNextConditionsCheck = function(time)
{
  this.nextStartActionTimer = setTimeout(
    function(runningAlarm)
    {
      runningAlarm.nextStartActionTimer = null;
      runningAlarm.checkConditions();
    },
    Math.max(time - Date.now(), 100),
    this
  );
};

/**
 * @private
 */
RunningAlarm.prototype.executeNextStartAction = function()
{
  if (this.nextStartActionTimer !== null)
  {
    return;
  }

  var startActions = this.model.startActions;
  var startActionCount = startActions.length;

  if (startActionCount === 0)
  {
    if (!this.model.isActive())
    {
      this.activate();
    }

    return;
  }

  if (this.currentActionIndex >= startActionCount - 1)
  {
    return;
  }

  var currentStartActionIndex = this.model.getCurrentStartActionIndex(
    this.startConditionMetAt
  );

  if (this.currentActionIndex === -1)
  {
    if (currentStartActionIndex === -1)
    {
      this.scheduleNextConditionsCheck(
        this.model.getStartActionExecutionTime(0, this.startConditionMetAt)
      );
    }
    else
    {
      this.executeStartAction(currentStartActionIndex);
    }
  }
  else if (currentStartActionIndex === this.currentActionIndex)
  {
    this.scheduleNextConditionsCheck(
      this.model.getStartActionExecutionTime(
        this.currentActionIndex, this.startConditionMetAt
      )
    );
  }
  else
  {
    this.executeStartAction(currentStartActionIndex);
  }
};

/**
 * @private
 * @param {number} actionIndex
 */
RunningAlarm.prototype.executeStartAction = function(actionIndex)
{
  var runningAlarm = this;

  if (this.model.isRunning())
  {
    this.activate(executeAction);
  }
  else
  {
    executeAction();
  }

  function executeAction(err)
  {
    if (err)
    {
      return;
    }

    runningAlarm.currentActionIndex = actionIndex;

    var model = runningAlarm.model;
    var action = model.startActions[actionIndex].toObject();

    action.no = actionIndex + 1;

    runningAlarm.alarmsModule.info(
      "Executing %s action %d of alarm %s...",
      action.type,
      action.no,
      model.name
    );

    if (typeof actions[action.type] === 'object')
    {
      actions[action.type].execute(
        runningAlarm.app, runningAlarm.alarmsModule, runningAlarm, action
      );
    }

    runningAlarm.broker.publish('alarms.actionExecuted', {
      model: runningAlarm.toJSON(),
      action: action,
      severity: action.severity
    });

    var nextActionStartTime = model.getStartActionExecutionTime(
      actionIndex + 1, runningAlarm.startConditionMetAt
    );

    if (nextActionStartTime !== -1)
    {
      runningAlarm.scheduleNextConditionsCheck(nextActionStartTime);
    }
  }
};

/**
 * @private
 * @param {function(Error|null)} [done]
 */
RunningAlarm.prototype.activate = function(done)
{
  var runningAlarm = this;

  this.model.state = this.Alarm.State.ACTIVE;

  this.model.save(function(err, model)
  {
    if (err)
    {
      runningAlarm.alarmsModule.error(
        "Failed to activate alarm: %s", err.message
      );
    }
    else
    {
      runningAlarm.alarmsModule.info("Alarm activated: %s", model.name);

      runningAlarm.broker.publish('alarms.activated', {
        model: runningAlarm.toJSON()
      });
    }

    if (done)
    {
      done(err);
    }
  });
};

/**
 * @private
 * @param {object} [user]
 * @param {function(Error|null)} [done]
 */
RunningAlarm.prototype.deactivate = function(user, done)
{
  var runningAlarm = this;

  clearTimeout(this.nextStartActionTimer);
  this.nextStartActionTimer = null;

  this.currentActionIndex = -1;

  this.model.state = this.Alarm.State.RUNNING;

  this.model.save(function(err, model)
  {
    if (err)
    {
      runningAlarm.alarmsModule.error(
        "Failed to deactivate alarm: %s", err.message
      );
    }
    else
    {
      runningAlarm.alarmsModule.info(
        "Alarm deactivated by %s: %s",
        user ? user.login : 'system',
        model.name
      );

      runningAlarm.broker.publish('alarms.deactivated', {
        user: user,
        model: runningAlarm.toJSON()
      });
    }

    if (done)
    {
      done(err);
    }

    runningAlarm.checkConditions();
  });
};

/**
 * @private
 */
RunningAlarm.prototype.checkStartCondition = function()
{
  try
  {
    return !!this.startConditionFunction(this.controller.values);
  }
  catch (err)
  {
    this.handleConditionCheckFailure(err.toJSON(), 'start');
  }

  return false;
};

/**
 * @private
 */
RunningAlarm.prototype.checkStopCondition = function()
{
  if (this.model.isManualStop())
  {
    return false;
  }

  if (this.model.isNegatedStop())
  {
    return !this.checkStartCondition();
  }

  if (this.checkStartCondition())
  {
    return false;
  }

  try
  {
    return !!this.stopConditionFunction(this.controller.values);
  }
  catch (err)
  {
    this.handleConditionCheckFailure(err.toJSON(), 'stop');
  }

  return false;
};

/**
 * @private
 * @param {object} checkError
 * @param {string} conditionKind
 */
RunningAlarm.prototype.handleConditionCheckFailure =
  function(checkError, conditionKind)
{
  this.broker.publish('alarms.conditionCheckFailed', {
    model: this.model.toObject(),
    error: checkError,
    conditionKind: conditionKind
  });

  var alarmName = this.model.name;
  var alarmsModule = this.alarmsModule;

  this.stop(null, function(err)
  {
    if (err)
    {
      alarmsModule.error(
        "Failed to stop alarm %s because of a condition check failure: %s",
        err.message,
        alarmName
      );
    }
    else
    {
      alarmsModule.debug(
        "Stopped alarm %s because of a condition check failure: %s",
        alarmName,
        checkError
      );
    }
  });
};

/**
 * @private
 */
RunningAlarm.prototype.watchTagValues = function()
{
  var broker = this.broker;
  var checkConditions = this.checkConditions.bind(this);

  function subscribe(tagName)
  {
    broker.subscribe('alarms.tagChanged.' + tagName, checkConditions);
  }

  this.model.startConditionTags.forEach(subscribe);
  this.model.stopConditionTags.forEach(subscribe);
};

/**
 * @private
 */
RunningAlarm.prototype.compileConditionFunctions = function()
{
  var startFunction = this.model.startFunction.trim();

  if (startFunction.length > 0)
  {
    this.startConditionFunction = this.compileConditionFunction(startFunction);
  }

  var stopFunction = this.model.stopFunction.trim();

  if (stopFunction.length > 0)
  {
    this.stopConditionFunction = this.compileConditionFunction(stopFunction);
  }
};

/**
 * @private
 * @returns {function(object)}
 */
RunningAlarm.prototype.compileConditionFunction = function(code)
{
  /*jshint evil:true*/

  try
  {
    return new Function('$__values__', code);
  }
  catch (err)
  {
    this.alarmsModule.error(
      "Failed to compile condition function for alarm %s: %s",
      this.model.name,
      err.message
    );

    this.broker.publish('alarms.compileFailed', {
      model: this.model.toObject(),
      error: err.toJSON()
    });

    return function() { return false; };
  }
};
