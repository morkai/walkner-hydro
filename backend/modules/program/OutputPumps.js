// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var util = require('util');
var step = require('h5.step');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var OutputPump = require('./OutputPump');

module.exports = OutputPumps;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 */
function OutputPumps(broker, modbus, program)
{
  ControlUnit.call(this, broker, modbus, program, 'outputPumps');

  /**
   * @private
   * @type {object.<string, *>}
   */
  this.timers = {
    manage: null
  };

  /**
   * @private
   * @type {number}
   */
  this.maxOutputPressureReachedAt = -1;

  /**
   * @private
   * @type {number}
   */
  this.minOutputPressureReachedAt = -1;

  /**
   * @private
   * @type {number}
   */
  this.presetRefResetAt = -1;

  /**
   * @private
   * @type {object.<number, OutputPump>}
   */
  this.outputPumps = {};

  for (var i = 1; i <= program.config.outputPumpCount; ++i)
  {
    this.outputPumps[i] = new OutputPump(broker, modbus, program, i);
  }

  this.watch('.*.status.vfd', 'updatePresetRefResetTime');

  this.watch(
    [
      '.dryRun',
      '.minOutputPressure',
      '.maxOutputPressure',
      '.minTotalWaterLevel',
      '.*.switch',
      '.*.state',
      '.*.mode',
      '.*.control',
      '.*.status',
      'reservoirs.*.state',
      'outputPressure'
    ],
    'manageOutputPumps'
  );
}

util.inherits(OutputPumps, ControlUnit);

/**
 * @returns {string}
 */
OutputPumps.prototype.getWorkMode = function()
{
  return this.getTagValue('.workMode') || 'onoff';
};

/**
 * @returns {string}
 */
OutputPumps.prototype.isConstantWorkMode = function()
{
  return this.getWorkMode() === 'constant';
};

/**
 * @returns {string}
 */
OutputPumps.prototype.isOnOffWorkMode = function()
{
  return this.getWorkMode() === 'onoff';
};

/**
 * @returns {boolean}
 */
OutputPumps.prototype.isDryRun = function()
{
  return !!this.getTagValue('.dryRun');
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getMaxConstantRunTime = function()
{
  var maxConstantRunTime = this.getTagValue('.maxConstantRunTime') || 0;

  return maxConstantRunTime < 1 ? -1 : maxConstantRunTime;
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getMinTotalWaterLevel = function()
{
  var minTotalWaterLevel = this.getTagValue('.minTotalWaterLevel') || 0;

  return minTotalWaterLevel <= 0 ? -1 : minTotalWaterLevel;
};

/**
 * @returns {number|null}
 */
OutputPumps.prototype.getMaxOutputPressure = function()
{
  return this.getTagValue('.maxOutputPressure');
};

/**
 * @returns {number|null}
 */
OutputPumps.prototype.getOutputPressure = function()
{
  return this.getTagValue('outputPressure');
};

/**
 * @returns {number|null}
 */
OutputPumps.prototype.getDesiredOutputPressure = function()
{
  var desiredOutputPressure = this.getTagValue('.desiredOutputPressure');

  if (desiredOutputPressure)
  {
    return desiredOutputPressure;
  }

  var minOutputPressure = this.getMinOutputPressure();
  var maxOutputPressure = this.getMaxOutputPressure();

  return (Math.round((minOutputPressure + maxOutputPressure) / 2 * 100) / 100) || null;
};

/**
 * @returns {number|null}
 */
OutputPumps.prototype.getMinOutputPressure = function()
{
  return this.getTagValue('.minOutputPressure');
};

/**
 * @returns {number|null}
 */
OutputPumps.prototype.getFirstPumpStabilizationTime = function()
{
  return this.getStabilizationTime('firstPump', 5);
};

/**
 * @returns {number|null}
 */
OutputPumps.prototype.getNextPumpStabilizationTime = function()
{
  return this.getStabilizationTime('nextPump', 10);
};

/**
 * @returns {number|null}
 */
OutputPumps.prototype.getStopPumpStabilizationTime = function()
{
  return this.getStabilizationTime('stopPump', 2);
};

/**
 * @returns {boolean}
 */
OutputPumps.prototype.hasEnoughWater = function()
{
  var total = this.program.reservoirs.getTotalWaterLevel();
  var min = this.getMinTotalWaterLevel();

  return min !== -1 && total >= min;
};

/**
 * @returns {boolean}
 */
OutputPumps.prototype.isAnyRunning = function()
{
  return lodash.some(this.outputPumps, function(outputPump)
  {
    return outputPump.isRunning();
  });
};

/**
 * @returns {boolean}
 */
OutputPumps.prototype.isVfdRunning = function()
{
  return lodash.some(this.outputPumps, function(outputPump)
  {
    return outputPump.isRunningThroughVfd();
  });
};

/**
 * @returns {Array.<OutputPump>}
 */
OutputPumps.prototype.getRunning = function()
{
  return lodash.filter(this.outputPumps, function(outputPump)
  {
    return outputPump.isActive()
      && outputPump.isAutoMode()
      && outputPump.isRunning();
  });
};

/**
 * @returns {OutputPump|null}
 */
OutputPumps.prototype.getRunningThroughVfd = function()
{
  return lodash.find(this.outputPumps, function(outputPump)
  {
    return outputPump.isActive()
      && outputPump.isAutoMode()
      && outputPump.isRunningThroughVfd();
  }) || null;
};

/**
 * @returns {number|null}
 */
OutputPumps.prototype.getPresetRef = function()
{
  return this.getTagValue('.presetRef');
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getMinPresetRef = function()
{
  var minValue = this.getTagValue('.presetRef.minValue');
  var maxValue = this.getMaxPresetRef();

  if (!minValue || minValue < 0 || minValue >= maxValue)
  {
    return 0;
  }

  return minValue;
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getMaxPresetRef = function()
{
  var maxValue = this.getTagValue('.presetRef.maxValue');

  if (!maxValue)
  {
    return 100;
  }

  if (maxValue <= 0)
  {
    return 1;
  }

  return maxValue;
};

/**
 * @returns {boolean}
 */
OutputPumps.prototype.isMaxPresetRef = function()
{
  return this.getPresetRef() >= this.getMaxPresetRef();
};

/**
 * @returns {boolean}
 */
OutputPumps.prototype.isMinPresetRef = function()
{
  return this.getPresetRef() <= this.getMinPresetRef();
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getLastPresetRefChangeTime = function()
{
  return this.getLastTagChangeTime('.presetRef');
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getPresetRefStartingValue = function()
{
  var startingValue = this.getTagValue('.presetRef.startingValue');

  return startingValue === null || startingValue < 0 ? 0 : startingValue;
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getPresetRefAdjustDelay = function()
{
  var adjustDelay = this.getTagValue('.presetRef.adjustDelay');

  return (adjustDelay === null || adjustDelay <= 0 ? 1 : adjustDelay) * 1000;
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getPresetRefStepInterval = function()
{
  var stepInterval = this.getTagValue('.presetRef.stepInterval');

  return (stepInterval === null || stepInterval <= 0 ? 1 : stepInterval) * 1000;
};

/**
 * @returns {boolean}
 */
OutputPumps.prototype.isOutputPressureSensorFailing = function()
{
  return this.getOutputPressure() === null;
};

/**
 * @returns {number}
 */
OutputPumps.prototype.getPresetRefStepValue = function()
{
  var stepValue = this.getTagValue('.presetRef.stepValue');

  return stepValue === null || stepValue <= 0 ? 5 : stepValue;
};

/**
 * @private
 * @param {string} type
 * @param {number} defaultValue
 * @returns {number}
 */
OutputPumps.prototype.getStabilizationTime = function(type, defaultValue)
{
  var time = this.getTagValue('.stabilizationTimes.' + type);

  if (time === null || time <= 0)
  {
    return defaultValue * 1000;
  }
  else
  {
    return time * 1000;
  }
};

/**
 * @private
 */
OutputPumps.prototype.scheduleManageTimer = function()
{
  if (this.timers.manage !== null)
  {
    clearTimeout(this.timers.manage);
  }

  this.timers.manage = setTimeout(
    this.manageOutputPumps.bind(this),
    this.getPresetRefStepInterval()
  );
};

/**
 * @private
 * @param {string} id
 * @param {number} delay
 */
OutputPumps.prototype.scheduleNextManageTimer = function(id, delay)
{
  if (!lodash.isUndefined(this.timers[id]))
  {
    return;
  }

  function removeTimerAndManage(outputPumps, id)
  {
    delete outputPumps.timers[id];

    outputPumps.manageOutputPumps();
  }

  this.timers[id] = setTimeout(removeTimerAndManage, delay, this, id);
};

/**
 * @private
 */
OutputPumps.prototype.manageOutputPumps = function()
{
  this.scheduleManageTimer();

  var lock = this.lock('manageOutputPumps');

  if (lock.isLocked())
  {
    return;
  }

  lock.on();

  if (this.isOutputPressureSensorFailing())
  {
    return this.stopRunningOutputPumps("output pressure sensor failure", lock);
  }

  if (this.isDryRun())
  {
    return this.stopRunningOutputPumps("dry run sensed", lock);
  }

  if (!this.hasEnoughWater())
  {
    return this.stopRunningOutputPumps("not enough clean water", lock);
  }

  if (this.isConstantWorkMode())
  {
    return this.handleConstantWorkMode(lock);
  }

  this.handleOnOffWorkMode(lock);
};

/**
 * @private
 * @param {Lock} lock
 */
OutputPumps.prototype.handleOnOffWorkMode = function(lock)
{
  if (this.isMaxOutputPressureReached())
  {
    this.minOutputPressureReachedAt = -1;

    return this.handleMaxOutputPressure(lock);
  }

  this.maxOutputPressureReachedAt = -1;

  if (this.isMinOutputPressureReached())
  {
    return this.handleMinOutputPressure(lock);
  }

  this.minOutputPressureReachedAt = -1;

  this.handlePresetRef(this.getPresetRefStepValue(), lock);
};

/**
 * @private
 * @param {Lock} lock
 */
OutputPumps.prototype.handleConstantWorkMode = function(lock)
{
  var actual = this.getOutputPressure();
  var desired = this.getDesiredOutputPressure();
  var minReached = this.isMinOutputPressureReached();

  if (minReached)
  {
    if (this.minOutputPressureReachedAt === -1)
    {
      this.minOutputPressureReachedAt = Date.now();
    }
  }
  else
  {
    this.minOutputPressureReachedAt = -1;
  }

  if (this.isMaxOutputPressureReached())
  {
    if (this.maxOutputPressureReachedAt === -1)
    {
      this.maxOutputPressureReachedAt = Date.now();
    }
  }
  else
  {
    this.maxOutputPressureReachedAt = -1;
  }

  if (this.isAnyMaxConstantRunTimeReached())
  {
    return this.stopConstantlyRunningOutputPump(lock);
  }

  var diff = Math.round((actual - desired) * 100) / 100;

  if (diff >= 1.5)
  {
    return this.stopRunningOutputPumps("output pressure greater than desired", lock);
  }

  var dir = diff > 0 ? -1 : 1;

  if (this.isDesiredOutputPressureReached())
  {
    this.debug(
      "Not adjusting the preset reference: desired output pressure of [%d] reached: %d.", desired, actual
    );

    return lock.off();
  }

  if (minReached && !this.isAnyRunning())
  {
    return this.handleMinOutputPressure(lock);
  }

  var absDiff = Math.abs(diff);
  var stepValue = 0;

  if (absDiff < 0.1)
  {
    stepValue = 0.25;
  }
  else if (absDiff < 0.2)
  {
    stepValue = 0.5;
  }
  else if (absDiff < 0.4)
  {
    stepValue = 0.75;
  }
  else if (absDiff < 0.8)
  {
    stepValue = 1;
  }
  else if (absDiff < 1)
  {
    stepValue = 2;
  }
  else
  {
    stepValue = 3;
  }

  this.handlePresetRef(stepValue * dir, lock);
};

/**
 * @private
 * @returns {Array.<OutputPump>}
 */
OutputPumps.prototype.getConstantlyRunningOutputPumps = function()
{
  var maxConstantRunTime = this.getMaxConstantRunTime();

  if (maxConstantRunTime === -1)
  {
    return [];
  }

  return this.getRunning().filter(outputPump => outputPump.getRunTime() >= maxConstantRunTime);
};

/**
 * @private
 * @returns {boolean}
 */
OutputPumps.prototype.isAnyMaxConstantRunTimeReached = function()
{
  return this.getConstantlyRunningOutputPumps().length > 0;
};

/**
 * @private
 * @param {Lock} lock
 */
OutputPumps.prototype.stopConstantlyRunningOutputPump = function(lock)
{
  var outputPumps = this.getConstantlyRunningOutputPumps().sort((a, b) => b.getRunTime() - a.getRunTime());
  var outputPumpToStop = outputPumps[0];

  this.stopOutputPump(outputPumpToStop, lock);
};

/**
 * @private
 * @param {Lock} lock
 */
OutputPumps.prototype.handleMaxOutputPressure = function(lock)
{
  if (this.maxOutputPressureReachedAt === -1)
  {
    this.debug(
      "Max output pressure reached (max=%s current=%s)...",
      this.getMaxOutputPressure(),
      this.getOutputPressure()
    );

    this.maxOutputPressureReachedAt = Date.now();
  }

  if (this.hasMaxOutputPressureStabilized())
  {
    this.debug(
      "...max output pressure stabilized (max=%s current=%s).",
      this.getMaxOutputPressure(),
      this.getOutputPressure()
    );

    return this.stopSingleOutputPump(lock);
  }

  this.debug(
    "...max output pressure not stabilized yet (max=%s current=%s)...",
    this.getMaxOutputPressure(),
    this.getOutputPressure()
  );

  lock.off();
};

/**
 * @private
 * @param {Lock} lock
 */
OutputPumps.prototype.handleMinOutputPressure = function(lock)
{
  if (this.minOutputPressureReachedAt === -1)
  {
    this.debug(
      "Min output pressure reached (min=%s current=%s)...",
      this.getMinOutputPressure(),
      this.getOutputPressure()
    );

    this.minOutputPressureReachedAt = Date.now();
  }

  if (this.hasMinOutputPressureStabilized())
  {
    this.debug(
      "...min output pressure stabilized (min=%s current=%s).",
      this.getMinOutputPressure(),
      this.getOutputPressure()
    );

    if (this.shouldStartNextOutputPump())
    {
      this.minOutputPressureReachedAt = -1;

      return this.startNextOutputPump(lock);
    }

    return this.handlePresetRef(this.getPresetRefStepValue(), lock);
  }

  this.debug(
    "...min output pressure not stabilized yet (min=%s current=%s)...",
    this.getMinOutputPressure(),
    this.getOutputPressure()
  );

  lock.off();
};

/**
 * @private
 * @param {number} stepValue
 * @param {Lock} lock
 */
OutputPumps.prototype.handlePresetRef = function(stepValue, lock)
{
  if (!this.shouldChangePresetRef(stepValue))
  {
    return lock.off();
  }

  var newPresetRef = this.getPresetRef() + stepValue;
  var minPresetRef = this.getMinPresetRef();
  var maxPresetRef = this.getMaxPresetRef();

  if (newPresetRef > maxPresetRef)
  {
    newPresetRef = maxPresetRef;
  }
  else if (newPresetRef < minPresetRef)
  {
    newPresetRef = minPresetRef;
  }

  newPresetRef = Math.round(newPresetRef * 100) / 100;

  var controlUnit = this;

  this.setTagValue('.presetRef', newPresetRef, function(err, unchanged)
  {
    if (err)
    {
      controlUnit.error(
        "Failed to adjust the preset reference to %d: %s",
        newPresetRef,
        err.message
      );
    }
    else if (!unchanged)
    {
      controlUnit.debug("Adjusted the preset reference to %d.", newPresetRef);
    }

    if (newPresetRef === maxPresetRef)
    {
      controlUnit.minOutputPressureReachedAt = -1;
    }

    lock.off();
  });
};

/**
 * @private
 * @param {string} reason
 * @param {Lock} lock
 */
OutputPumps.prototype.stopRunningOutputPumps = function(reason, lock)
{
  var outputPumps = this.getRunning();
  var controlUnit = this;

  this.maxOutputPressureReachedAt = -1;
  this.minOutputPressureReachedAt = -1;

  if (outputPumps.length === 0)
  {
    return lock.off();
  }

  this.debug("Stopping all %d pumps: %s...", outputPumps.length, reason);

  step(
    function stopRunningOutputPumpsStep()
    {
      var step = this;

      lodash.each(outputPumps, function(outputPump)
      {
        var done = step.parallel();

        outputPump.stop(function(err, unchanged)
        {
          if (err)
          {
            controlUnit.error(
              "Failed to stop the running output pump %d: %s",
              outputPump.getIndex(),
              err.message
            );
          }
          else if (!unchanged)
          {
            controlUnit.debug(
              "Stopped the running output pump %d.", outputPump.getIndex()
            );
          }

          done();
        });
      });
    },
    function unlockStep()
    {
      lock.off();
    }
  );
};

/**
 * @private
 * @param {Lock} lock
 */
OutputPumps.prototype.stopSingleOutputPump = function(lock)
{
  var runningOutputPumps = this.getRunning();

  if (runningOutputPumps.length === 0)
  {
    this.debug("No single output pump to stop.");

    return lock.off();
  }

  runningOutputPumps.sort(
    function compareByControlTypeAndWorkTime(outputPump1, outputPump2)
    {
      if (outputPump1.isStartedByGrid())
      {
        if (outputPump2.isStartedByGrid())
        {
          return outputPump2.getWorkTime() - outputPump1.getWorkTime();
        }

        return -1;
      }

      return 1;
    }
  );

  this.stopOutputPump(runningOutputPumps[0], lock);
};

/**
 * @private
 * @param {OutputPump} outputPumpToStop
 * @param {Lock} lock
 */
OutputPumps.prototype.stopOutputPump = function(outputPumpToStop, lock)
{
  var startedByGrid = outputPumpToStop.isStartedByGrid();
  var controlUnit = this;

  outputPumpToStop.stop(function(err, unchanged)
  {
    if (err)
    {
      controlUnit.error(
        "Failed to stop a single output pump %d: %s",
        outputPumpToStop.getIndex(),
        err.message
      );
    }
    else if (!unchanged)
    {
      controlUnit.debug(
        "Stopped a single output pump %d (started by %s).",
        outputPumpToStop.getIndex(),
        startedByGrid ? 'grid' : 'VFD'
      );
    }

    lock.off();
  });
};

/**
 * @private
 * @param {Lock} lock
 */
OutputPumps.prototype.startNextOutputPump = function(lock)
{
  var freeOutputPump = this.getNextFreeOutputPump();

  if (freeOutputPump === null)
  {
    if (this.isVfdRunning())
    {
      this.warn(
        "Failed to start the next output pump through grid: "
          + "no pumps available."
      );

      return lock.off();
    }

    return this.switchToVfdControl(lock);
  }

  this.startOutputPumpThrough(
    freeOutputPump, this.isVfdRunning() ? 'grid' : 'vfd', lock
  );
};

/**
 * @private
 * @param {OutputPump} freeOutputPump
 * @param {string} controlType
 * @param {Lock} lock
 */
OutputPumps.prototype.startOutputPumpThrough = function(freeOutputPump, controlType, lock)
{
  var controlUnit = this;

  this.resetPresetRef(function(err, unchanged)
  {
    if (err)
    {
      controlUnit.error("Failed to reset the preset ref: %s", err.message);

      return lock.off();
    }
    else if (!unchanged)
    {
      controlUnit.debug("Reset the preset ref.");
    }

    freeOutputPump.start(controlType, function(err)
    {
      if (err)
      {
        controlUnit.error(
          "Failed to start output pump %d through %s: %s",
          freeOutputPump.getIndex(),
          controlType,
          err.message
        );
      }
      else
      {
        controlUnit.debug(
          "Started output pump %d through %s.",
          freeOutputPump.getIndex(),
          controlType
        );
      }

      lock.off();
    });
  });
};

/**
 * @private
 * @param {Lock} lock
 */
OutputPumps.prototype.switchToVfdControl = function(lock)
{
  var outputPumps = this.getRunning().sort(this.compareByWorkTime);

  if (outputPumps.length === 0)
  {
    this.debug("Cannot switch to VFD control.");

    return lock.off();
  }

  var outputPump = outputPumps[0];
  var controlUnit = this;

  this.debug("Switching pump %d to VFD control...", outputPump.getIndex());

  outputPump.stop(function(err)
  {
    if (err)
    {
      controlUnit.error(
        "Failed to switch pump %d to VFD control: %s",
        outputPump.getIndex(),
        err.message
      );

      return lock.off();
    }

    controlUnit.startOutputPumpThrough(outputPump, 'vfd', lock);
  });
};

/**
 * @private
 * @param {number} stepValue
 * @returns {boolean}
 */
OutputPumps.prototype.shouldChangePresetRef = function(stepValue)
{
  if (this.getRunningThroughVfd() === null)
  {
    this.debug("Not adjusting the preset reference: no running VFD pump.");

    return false;
  }

  if (this.presetRefResetAt === -1)
  {
    this.debug("Not adjusting the preset reference: preset ref not reset.");

    return false;
  }

  if (stepValue < 0 && this.isMinPresetRef())
  {
    this.debug("Not adjusting the preset reference: min preset ref reached.");

    return false;
  }

  if (stepValue > 0 && this.isMaxPresetRef())
  {
    this.debug("Not adjusting the preset reference: max preset ref reached.");

    return false;
  }

  var now = Date.now();
  var timeSincePresetRefReset = now - this.presetRefResetAt;
  var adjustDelay = this.getPresetRefAdjustDelay();

  if (timeSincePresetRefReset < adjustDelay)
  {
    this.scheduleNextManageTimer(
      'presetRefAdjustDelay', adjustDelay - timeSincePresetRefReset
    );

    this.debug("Not adjusting the preset reference: preset ref adjust delay.");

    return false;
  }

  var timeSinceLastChange = now - this.getLastPresetRefChangeTime();
  var stepInterval = this.getPresetRefStepInterval();

  if (timeSinceLastChange < stepInterval)
  {
    this.scheduleNextManageTimer(
      'presetRefStepInterval', stepInterval - timeSinceLastChange
    );

    this.debug("Not adjusting the preset reference: preset ref step interval.");

    return false;
  }

  return true;
};

/**
 * @private
 * @returns {boolean}
 */
OutputPumps.prototype.shouldStartNextOutputPump = function()
{
  return !this.isAnyRunning()
    || this.isMaxPresetRef()
    || !this.isVfdRunning();
};

/**
 * @private
 * @returns {boolean}
 */
OutputPumps.prototype.isDesiredOutputPressureReached = function()
{
  var outputPressure = this.getOutputPressure();
  var desiredOutputPressure = this.getDesiredOutputPressure();

  if (outputPressure === null || desiredOutputPressure === null)
  {
    return false;
  }

  var minDesiredOutputPressure = desiredOutputPressure - 0.05;
  var maxDesiredOutputPressure = desiredOutputPressure + 0.05;

  return outputPressure <= maxDesiredOutputPressure && outputPressure >= minDesiredOutputPressure;
};

/**
 * @private
 * @returns {boolean}
 */
OutputPumps.prototype.isMaxOutputPressureReached = function()
{
  var outputPressure = this.getOutputPressure();
  var maxOutputPressure = this.getMaxOutputPressure();

  if (outputPressure === null || maxOutputPressure === null)
  {
    return false;
  }

  return outputPressure > maxOutputPressure;
};

/**
 * @private
 * @returns {boolean}
 */
OutputPumps.prototype.isMinOutputPressureReached = function()
{
  var outputPressure = this.getOutputPressure();
  var minOutputPressure = this.getMinOutputPressure();

  if (outputPressure === null || minOutputPressure === null)
  {
    return false;
  }

  return outputPressure < minOutputPressure;
};

/**
 * @private
 * @returns {boolean}
 */
OutputPumps.prototype.hasMaxOutputPressureStabilized = function()
{
  var diff = Date.now() - this.maxOutputPressureReachedAt;
  var stabilizationTime = this.getStopPumpStabilizationTime();

  if (diff < stabilizationTime)
  {
    this.scheduleNextManageTimer('maxOutputPressure', stabilizationTime - diff);

    return false;
  }

  return true;
};

/**
 * @private
 * @returns {boolean}
 */
OutputPumps.prototype.hasMinOutputPressureStabilized = function()
{
  var diff = Date.now() - this.minOutputPressureReachedAt;
  var stabilizationTime = 0;

  if (this.isVfdRunning() && !this.isMaxPresetRef())
  {
    stabilizationTime = this.getPresetRefAdjustDelay();
  }
  else if (this.isAnyRunning())
  {
    stabilizationTime = this.getNextPumpStabilizationTime();
  }
  else
  {
    stabilizationTime = this.getFirstPumpStabilizationTime();
  }

  if (diff < stabilizationTime)
  {
    this.scheduleNextManageTimer('minOutputPressure', stabilizationTime - diff);

    return false;
  }

  return true;
};

/**
 * @private
 * @returns {OutputPump|null}
 */
OutputPumps.prototype.getNextFreeOutputPump = function()
{
  var freeOutputPumps = lodash.filter(this.outputPumps, function(outputPump)
  {
    return outputPump.isActive()
      && outputPump.isAutoMode()
      && !outputPump.isRunning();
  });

  if (freeOutputPumps.length === 0)
  {
    return null;
  }

  freeOutputPumps.sort(this.compareByWorkTime);

  return freeOutputPumps[0];
};

/**
 * @private
 * @param {OutputPump} outputPump1
 * @param {OutputPump} outputPump2
 * @returns {number}
 */
OutputPumps.prototype.compareByWorkTime = function(outputPump1, outputPump2)
{
  return outputPump1.getWorkTime() - outputPump2.getWorkTime();
};

/**
 * @private
 */
OutputPumps.prototype.updatePresetRefResetTime = function()
{
  if (this.isVfdRunning())
  {
    this.presetRefResetAt = Date.now();
  }
  else
  {
    this.presetRefResetAt = -1;
  }
};

/**
 * @private
 * @param {function(Error|null)} done
 */
OutputPumps.prototype.resetPresetRef = function(done)
{
  var startingValue = this.getPresetRefStartingValue();
  var outputPump = this;

  this.setTagValue('.presetRef', startingValue, function(err, unchanged)
  {
    if (!err)
    {
      outputPump.presetRefResetAt = Date.now();
    }

    done(err, unchanged);
  });
};
