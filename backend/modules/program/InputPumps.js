// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var util = require('util');
var step = require('h5.step');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var InputPump = require('./InputPump');

module.exports = InputPumps;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 */
function InputPumps(broker, modbus, program)
{
  ControlUnit.call(this, broker, modbus, program, 'inputPumps');

  /**
   * @private
   * @type {object.<number, InputPump>}
   */
  this.inputPumps = {};

  for (var i = 1; i <= program.config.inputPumpCount; ++i)
  {
    this.inputPumps[i] = new InputPump(broker, modbus, program, i);
  }

  /**
   * @private
   * @type {*}
   */
  this.manageTimer = null;

  var manageInputPumps = program.exec.bind(
    null, this.manageInputPumps.bind(this), 'manageInputPumps'
  );

  this.broker.subscribe(
    'program.reservoirs.minWaterLevelReached', manageInputPumps
  );

  this.broker.subscribe(
    'program.reservoirs.maxWaterLevelReached', manageInputPumps
  );

  this.watch(
    [
      '.nextAfterTimeInMin',
      '.*.switch',
      '.*.state',
      '.*.mode',
      '.*.control',
      '.*.status',
      'reservoirs.*.state',
      'filterSets.*.currentPhase',
      'filterSets.*.valves.1.status',
      'filterSets.*.valves.5.status'
    ],
    'manageInputPumps'
  );
}

util.inherits(InputPumps, ControlUnit);

/**
 * @returns {number}
 */
InputPumps.prototype.getNextAfterTimeInMin = function()
{
  var nextAfterTimeInMin = this.getTagValue('.nextAfterTimeInMin') || 0;

  return nextAfterTimeInMin <= 0 ? -1 : (nextAfterTimeInMin * 1000);
};

/**
 * @returns {boolean}
 */
InputPumps.prototype.isAnyActive = function()
{
  return lodash.some(this.inputPumps, function(inputPump)
  {
    return inputPump.isActive();
  });
};

/**
 * @returns {boolean}
 */
InputPumps.prototype.isAnyRunning = function()
{
  return lodash.some(this.inputPumps, function(inputPump)
  {
    return inputPump.isRunning();
  });
};

/**
 * @returns {boolean}
 */
InputPumps.prototype.isAnyAvailable = function()
{
  return lodash.some(this.inputPumps, function(inputPump)
  {
    return inputPump.isActive()
      && inputPump.isAutoMode()
      && !inputPump.isFailure();
  });
};

/**
 * @returns {InputPump}
 */
InputPumps.prototype.get = function(index)
{
  return this.inputPumps[index] || null;
};

/**
 * @private
 */
InputPumps.prototype.scheduleManageTimer = function()
{
  if (this.manageTimer !== null)
  {
    clearTimeout(this.manageTimer);
  }

  var manageDelay = this.getNextAfterTimeInMin();

  if (manageDelay !== -1)
  {
    this.manageTimer = setTimeout(
      this.manageInputPumps.bind(this), manageDelay
    );
  }
};

/**
 * @private
 */
InputPumps.prototype.manageInputPumps = function()
{
  this.scheduleManageTimer();

  var lock = this.lock('manageInputPumps');

  if (lock.isLocked())
  {
    return;
  }

  lock.on();

  var stopReason = this.shouldStopRunningInputPumps();

  if (stopReason !== null)
  {
    return this.stopRunningInputPumps(stopReason, lock);
  }

  if (!this.program.reservoirs.isMinWaterLevelReached())
  {
    if (this.program.filterSets.isAnyWaitingForWashing())
    {
      this.debug("Filter set's waiting for washing...");

      return this.startSingleInputPump(lock);
    }

    return lock.off();
  }

  this.debug("Min clean water level reached...");

  if (this.shouldStartNextInputPump())
  {
    return this.startNextInputPump(lock);
  }

  this.startSingleInputPump(lock);
};

/**
 * @private
 * @returns {string|null}
 */
InputPumps.prototype.shouldStopRunningInputPumps = function()
{
  var filterSets = this.program.filterSets;
  var reservoirs = this.program.reservoirs;

  if (!filterSets.isAnyActive())
  {
    return "no active filter sets";
  }

  if (!reservoirs.isAnyActive())
  {
    return "no active reservoirs";
  }

  if (reservoirs.isMaxWaterLevelReached())
  {
    return "max clean water level reached";
  }

  if (!filterSets.areAnyWaterTreatingValvesOpen())
  {
    return "no water treating valves open";
  }

  return null;
};

/**
 * @private
 * @param {string} reason
 * @param {Lock} lock
 */
InputPumps.prototype.stopRunningInputPumps = function(reason, lock)
{
  if (!this.isAnyRunning())
  {
    return lock.off();
  }

  this.debug("Stopping all pumps: %s...", reason);

  var inputPumps = this.inputPumps;
  var controlUnit = this;

  step(
    function stopAllRunningInputPumpsStep()
    {
      var step = this;

      lodash.each(inputPumps, function(inputPump)
      {
        var done = step.parallel();

        if (inputPump.isActive()
          && inputPump.isAutoMode()
          && inputPump.isRunning())
        {
          inputPump.stop(function(err, unchanged)
          {
            if (err)
            {
              controlUnit.error(
                "Failed to stop the running input pump %d: %s",
                inputPump.getIndex(),
                err.message
              );
            }
            else if (!unchanged)
            {
              controlUnit.debug(
                "Stopped the running input pump %d.", inputPump.getIndex()
              );
            }

            done();
          });
        }
        else
        {
          process.nextTick(done);
        }
      });
    },
    function turnOffLockStep()
    {
      lock.off();
    }
  );
};

/**
 * @private
 * @param {Lock} lock
 */
InputPumps.prototype.startSingleInputPump = function(lock)
{
  if (this.isAnyRunning())
  {
    this.debug("...a single input pump is already running.");

    return lock.off();
  }

  var nextInputPump = this.getNextFreeInputPump();

  if (nextInputPump === null)
  {
    this.warn("Failed to start a single input pump: no pumps available.");

    return lock.off();
  }

  var controlUnit = this;

  nextInputPump.start(function(err, unchanged)
  {
    if (err)
    {
      controlUnit.error(
        "Failed to start a single input pump %d: %s",
        nextInputPump.getIndex(),
        err.message
      );
    }
    else if (!unchanged)
    {
      controlUnit.debug(
        "Started a single input pump %d.", nextInputPump.getIndex()
      );
    }

    lock.off();
  });
};

/**
 * @private
 * @returns {InputPump|null}
 */
InputPumps.prototype.getNextFreeInputPump = function()
{
  var availableInputPumps = [];

  lodash.each(this.inputPumps, function(inputPump)
  {
    if (inputPump.isActive()
      && inputPump.isAutoMode()
      && !inputPump.isRunning()
      && !inputPump.isFailure()
      && !inputPump.isDryRun())
    {
      availableInputPumps.push(inputPump);
    }
  });

  availableInputPumps.sort(function(a, b)
  {
    return a.getLastUseTime() - b.getLastUseTime();
  });

  return availableInputPumps.length > 0 ? availableInputPumps[0] : null;
};

/**
 * @private
 * @returns {boolean}
 */
InputPumps.prototype.shouldStartNextInputPump = function()
{
  var nextAfterTimeInMin = this.getNextAfterTimeInMin();

  if (nextAfterTimeInMin === -1)
  {
    return false;
  }

  var runningInputPumps = [];

  lodash.each(this.inputPumps, function(inputPump)
  {
    if (inputPump.isRunning())
    {
      runningInputPumps.push(inputPump);
    }
  });

  if (runningInputPumps.length === 0)
  {
    return false;
  }

  runningInputPumps.sort(function(a, b)
  {
    return b.getLastStatusChangeTime() - a.getLastStatusChangeTime();
  });

  var lastStartedInputPump = runningInputPumps[0];
  var secondsSinceLastStart =
    Date.now() - lastStartedInputPump.getLastStatusChangeTime();

  return secondsSinceLastStart >= nextAfterTimeInMin;
};

/**
 * @private
 * @param {Lock} lock
 */
InputPumps.prototype.startNextInputPump = function(lock)
{
  var nextInputPump = this.getNextFreeInputPump();

  if (nextInputPump === null)
  {
    this.warn("Failed to start the next input pump: no pumps available.");

    return lock.off();
  }

  var controlUnit = this;

  nextInputPump.start(function(err, unchanged)
  {
    lock.off();

    if (err)
    {
      controlUnit.error(
        "Failed to start the next input pump %d: %s",
        nextInputPump.getIndex(),
        err.message
      );
    }
    else if (!unchanged)
    {
      controlUnit.debug(
        "Started the next input pump %d.", nextInputPump.getIndex()
      );
    }
  });
};
