// Part of <https://miracle.systems/p/walkner-utilio> licensed under <CC BY-NC-SA 4.0>

'use strict';

const actions = require('./actions');

module.exports = RunningAlarm;

/**
 * @constructor
 * @param {Object} app
 * @param {Object} alarmsModule
 * @param {Alarm} model
 */
function RunningAlarm(app, alarmsModule, model)
{
  /**
   * @private
   * @type {Object}
   */
  this.app = app;

  /**
   * @private
   * @type {Object}
   */
  this.alarmsModule = alarmsModule;

  /**
   * @private
   * @type {Object}
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
   * @type {?function(Object)}
   */
  this.startConditionFunction = null;

  /**
   * @private
   * @type {?function(Object)}
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

/**
 * @param {?Object} user
 * @param {function(?Error)} done
 * @returns {undefined}
 */
RunningAlarm.prototype.run = function(user, done)
{
  if (!this.model.isStopped())
  {
    return done();
  }

  this.model.state = this.Alarm.State.RUNNING;

  this.model.save((err) =>
  {
    if (err)
    {
      return done(err);
    }

    this.broker.publish('alarms.run', {
      user: user,
      model: this.toJSON()
    });

    done();

    this.checkConditions();
  });
};

/**
 * @param {?Object} user
 * @param {function(?Error)} done
 * @returns {undefined}
 */
RunningAlarm.prototype.stop = function(user, done)
{
  if (this.model.isStopped())
  {
    return done();
  }

  this.model.state = this.Alarm.State.STOPPED;

  clearTimeout(this.nextStartActionTimer);
  this.nextStartActionTimer = null;

  this.model.save((err) =>
  {
    if (err)
    {
      return done(err);
    }

    this.broker.publish('alarms.stopped', {
      user: user,
      model: this.toJSON()
    });

    done();
  });
};

/**
 * @param {?Object} user
 * @param {function(?Error)} done
 * @returns {undefined}
 */
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
    () =>
    {
      this.nextStartActionTimer = null;
      this.checkConditions();
    },
    Math.max(time - Date.now(), 100)
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

  const startActions = this.model.startActions;
  const startActionCount = startActions.length;

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

  const currentStartActionIndex = this.model.getCurrentStartActionIndex(this.startConditionMetAt);

  if (this.currentActionIndex === -1)
  {
    if (currentStartActionIndex === -1)
    {
      this.scheduleNextConditionsCheck(this.model.getStartActionExecutionTime(0, this.startConditionMetAt));
    }
    else
    {
      this.executeStartAction(currentStartActionIndex);
    }
  }
  else if (currentStartActionIndex === this.currentActionIndex)
  {
    this.scheduleNextConditionsCheck(
      this.model.getStartActionExecutionTime(this.currentActionIndex, this.startConditionMetAt)
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
  const runningAlarm = this;

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

    const model = runningAlarm.model;
    const action = model.startActions[actionIndex].toObject();

    action.no = actionIndex + 1;

    runningAlarm.alarmsModule.info(`Executing [${action.type}] action [${action.no}] of alarm [${model.name}]...`);

    if (typeof actions[action.type] === 'object')
    {
      actions[action.type].execute(runningAlarm.app, runningAlarm.alarmsModule, runningAlarm, action);
    }

    runningAlarm.broker.publish('alarms.actionExecuted', {
      model: runningAlarm.toJSON(),
      action: action,
      severity: action.severity
    });

    const nextActionStartTime = model.getStartActionExecutionTime(actionIndex + 1, runningAlarm.startConditionMetAt);

    if (nextActionStartTime !== -1)
    {
      runningAlarm.scheduleNextConditionsCheck(nextActionStartTime);
    }
  }
};

/**
 * @private
 * @param {function(?Error)} [done]
 */
RunningAlarm.prototype.activate = function(done)
{
  this.model.state = this.Alarm.State.ACTIVE;

  this.model.save((err, model) =>
  {
    if (err)
    {
      this.alarmsModule.error(`Failed to activate alarm: ${err.message}`);
    }
    else
    {
      this.alarmsModule.info(`Alarm activated: ${model.name}`);

      this.broker.publish('alarms.activated', {
        model: this.toJSON()
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
 * @param {Object} [user]
 * @param {function(?Error)} [done]
 */
RunningAlarm.prototype.deactivate = function(user, done)
{
  clearTimeout(this.nextStartActionTimer);
  this.nextStartActionTimer = null;

  this.currentActionIndex = -1;

  this.model.state = this.Alarm.State.RUNNING;

  this.model.save((err, model) =>
  {
    if (err)
    {
      this.alarmsModule.error(`Failed to deactivate alarm: ${err.message}`);
    }
    else
    {
      this.alarmsModule.info(`Alarm deactivated by [${user ? user.login : 'system'}]: ${model.name}`);

      this.broker.publish('alarms.deactivated', {
        user: user,
        model: this.toJSON()
      });
    }

    if (done)
    {
      done(err);
    }

    this.checkConditions();
  });
};

/**
 * @private
 * @returns {boolean}
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
 * @returns {boolean}
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
 * @param {Object} checkError
 * @param {string} conditionKind
 */
RunningAlarm.prototype.handleConditionCheckFailure = function(checkError, conditionKind)
{
  this.broker.publish('alarms.conditionCheckFailed', {
    model: this.model.toObject(),
    error: checkError,
    conditionKind: conditionKind
  });

  const alarmName = this.model.name;
  const alarmsModule = this.alarmsModule;

  this.stop(null, function(err)
  {
    if (err)
    {
      alarmsModule.error(`Failed to stop alarm [${alarmName}] because of a condition check failure: ${err.message}`);
    }
    else
    {
      alarmsModule.warn(`Stopped alarm [${alarmName}] because of a condition check failure:`, checkError);
    }
  });
};

/**
 * @private
 */
RunningAlarm.prototype.watchTagValues = function()
{
  const broker = this.broker;
  const checkConditions = this.checkConditions.bind(this);
  const subscribe = (tagName) => { broker.subscribe('alarms.tagChanged.' + tagName, checkConditions); };

  this.model.startConditionTags.forEach(subscribe);
  this.model.stopConditionTags.forEach(subscribe);
};

/**
 * @private
 */
RunningAlarm.prototype.compileConditionFunctions = function()
{
  const startFunction = this.model.startFunction.trim();

  if (startFunction.length > 0)
  {
    this.startConditionFunction = this.compileConditionFunction(startFunction);
  }

  const stopFunction = this.model.stopFunction.trim();

  if (stopFunction.length > 0)
  {
    this.stopConditionFunction = this.compileConditionFunction(stopFunction);
  }
};

/**
 * @private
 * @param {string} code
 * @returns {function(Object)}
 */
RunningAlarm.prototype.compileConditionFunction = function(code)
{
  try
  {
    return new Function('$', code); // eslint-disable-line no-new-func
  }
  catch (err)
  {
    this.alarmsModule.error(`Failed to compile condition function for alarm [${this.model.name}]: ${err.message}`);

    this.broker.publish('alarms.compileFailed', {
      model: this.model.toObject(),
      error: err.toJSON()
    });

    return function() { return false; };
  }
};
