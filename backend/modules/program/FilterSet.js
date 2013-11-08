'use strict';

var util = require('util');
var step = require('h5.step');
var ControlUnit = require('./ControlUnit');
var FilterSetPhase = require('./FilterSetPhase');
var filterSetPhases = require('./filterSetPhases');

module.exports = FilterSet;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 * @param {number} index
 */
function FilterSet(broker, modbus, program, index)
{
  ControlUnit.call(this, broker, modbus, program, 'filterSets', index);

  /**
   * @private
   * @type {FilterSetPhase|null}
   */
  this.currentPhase = null;

  /**
   * @private
   * @type {object}
   */
  this.timers = {
    manage: null
  };

  /**
   * @private
   * @type {function}
   */
  this.execManageFilterSet = this.bindExec('manageFilterSet');

  /**
   * @private
   * @type {number}
   */
  this.washingTimeFrameStart = -1;

  /**
   * @private
   * @type {number}
   */
  this.timeToMaxWashAfterHours = -1;

  this.broker.subscribe(
    'program.reservoirs.maxWaterLevelReached', this.execManageFilterSet
  );

  this.watch('inputFlow.total.forwards', 'updateFlowSinceLastWash');

  this.watch(
    [
      '.state',
      '.mode',
      '.currentPhase',
      '.flowSinceLastWash',
      '.valves.*.status',
      'filterSets.*',
      'blower.*',
      'washingPump.*',
      'settler.max.status'
    ],
    'manageFilterSet'
  );
}

util.inherits(FilterSet, ControlUnit);

/**
 * @returns {boolean}
 */
FilterSet.prototype.isActive = function()
{
  return !!this.getTagValue('.state');
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.getMode = function()
{
  return !!this.getTagValue('.mode');
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isRunning = function()
{
  return !!this.getTagValue('.status');
};

/**
 * @returns {FilterSetPhase|null}
 */
FilterSet.prototype.getCurrentPhase = function()
{
  return this.getTagValue('.currentPhase');
};

/**
 * @returns {number}
 */
FilterSet.prototype.getLastPhaseChangeTime = function()
{
  return this.getTagValue('.lastPhaseChangeTime') || 0;
};

/**
 * @returns {number}
 */
FilterSet.prototype.getFlowSinceLastWash = function()
{
  return this.getTagValue('.flowSinceLastWash') || 0;
};

/**
 * @returns {number}
 */
FilterSet.prototype.getTimeSinceLastWash = function()
{
  return this.getTagValue('.timeSinceLastWash') || 0;
};

/**
 * @returns {number}
 */
FilterSet.prototype.getHoursSinceLastWash = function()
{
  var hoursSinceLastWash = this.getTimeSinceLastWash() / 3600;

  if (this.isInPhase(FilterSetPhase.TREATMENT))
  {
    hoursSinceLastWash +=
      Math.round((Date.now() - this.getLastPhaseChangeTime()) / 1000) / 3600;
  }

  return hoursSinceLastWash;
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isManualMode = function()
{
  return !this.getMode();
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isAutoMode = function()
{
  return this.getMode();
};

/**
 * @param {FilterSetPhase} phase
 * @returns {boolean}
 */
FilterSet.prototype.isInPhase = function(phase)
{
  return this.getCurrentPhase() === phase;
};

/**
 * @param {FilterSetValve} valve
 * @returns {boolean}
 */
FilterSet.prototype.isValveOpen = function(valve)
{
  return !!this.getTagValue('.valves.' + valve + '.status');
};

/**
 * @param {Array.<FilterSetValve>} valves
 * @returns {boolean}
 */
FilterSet.prototype.areValvesOpen = function(valves)
{
  var l = valves.length;

  if (l === 0)
  {
    return false;
  }

  for (var i = 0; i < l; ++i)
  {
    if (!this.isValveOpen(valves[i]))
    {
      return false;
    }
  }

  return true;
};

/**
 * @param {Array.<FilterSetValve>} valves
 * @param {function(Error|null)} done
 */
FilterSet.prototype.openValves = function(valves, done)
{
  var filterSet = this;
  var steps = [];

  [1, 2, 3, 4, 5, 6].forEach(function(v)
  {
    steps.push(function setValveStep(err)
    {
      if (err)
      {
        return this.done(done, err);
      }

      filterSet.setTagValue(
        '.valves.' + v + '.control', valves.indexOf(v) !== -1, this.next()
      );
    });

    steps.push(function ackValveStep(err)
    {
      if (err)
      {
        return this.done(done, err);
      }

      filterSet.ackTagValue(
        '.valves.' + v + '.status', valves.indexOf(v) !== -1, this.next()
      );
    });
  });

  steps.push(done);

  step(steps);
};

/**
 * @param {FilterSetPhase} newPhase
 * @param {Lock} lock
 */
FilterSet.prototype.changePhase = function(newPhase, lock)
{
  var filterSet = this;
  var oldPhase = this.getCurrentPhase();

  filterSet.setTagValue('.currentPhase', newPhase, function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to change the phase from %s to %s: %s",
        oldPhase,
        newPhase,
        err.message
      );
    }

    return lock.off();
  });
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isInWashingTimeFrame = function()
{
  var currentHour = new Date().getHours();
  var washFromHour = this.getTagValue('filterSets.washFromHour') || 22;
  var washToHour = this.getTagValue('filterSets.washToHour') || 6;

  return washFromHour < washToHour
    ? currentHour >= washFromHour && currentHour < washToHour
    : !(currentHour < washFromHour && currentHour >= washToHour);
};

/**
 * @returns {number}
 */
FilterSet.prototype.getNextWashingTimeFrameStartTime = function()
{
  var startTime = new Date();
  startTime.setHours(this.getTagValue('filterSets.washFromHour') || 22);
  startTime.setMinutes(0);
  startTime.setSeconds(0);
  startTime.setMilliseconds(0);
  startTime = startTime.getTime();

  return Date.now() < startTime ? startTime : (startTime + 3600 * 24 * 1000);
};

/**
 * @returns {number}
 */
FilterSet.prototype.getTimeToMaxWashAfterHours = function()
{
  var washAfterHours = this.getTagValue('filterSets.washAfterHours');
  var hoursSinceLastWash = this.getHoursSinceLastWash();
  var diff = washAfterHours - hoursSinceLastWash;

  return Date.now() + (diff > 0 ? (diff * 3600 * 1000) : 0);
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isMaxFlowReached = function()
{
  var washAfterFlow = this.getTagValue('filterSets.washAfterFlow');
  var flowSinceLastWash = this.getFlowSinceLastWash();

  return flowSinceLastWash >= washAfterFlow;
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isMaxTreatmentTimeReached = function()
{
  var washAfterHours = this.getTagValue('filterSets.washAfterHours');
  var hoursSinceLastWash = this.getHoursSinceLastWash();

  return hoursSinceLastWash >= washAfterHours;
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isEnoughWaterForWashingAvailable = function()
{
  return this.program.reservoirs.isMaxWaterLevelReached();
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.shouldWash = function()
{
  return this.isMaxFlowReached() || this.isMaxTreatmentTimeReached();
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isBlowerAvailable = function()
{
  return this.program.blower.isAvailable();
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isWashingPumpAvailable = function()
{
  return this.program.washingPump.isAvailable();
};

/**
 * @returns {string|null}
 */
FilterSet.prototype.canWash = function()
{
  var program = this.program;

  if (!program.reservoirs.isAnyActive())
  {
    return "no active reservoirs";
  }

  if (!this.isEnoughWaterForWashingAvailable()
    && !program.inputPumps.isAnyRunning()
    && !program.inputPumps.isAnyAvailable())
  {
    return "no available input pumps for refilling";
  }

  if (!this.isBlowerAvailable())
  {
    return "blower is unavailable";
  }

  if (!this.isWashingPumpAvailable())
  {
    return "washing pump is unavailable";
  }

  if (program.filterSets.isAnyOtherWashing(this))
  {
    return "washing another filter set";
  }

  return null;
};

/**
 * @returns {boolean}
 */
FilterSet.prototype.isSettlerMaxReached = function()
{
  return !!this.getTagValue('settler.max.status');
};

/**
 * @param {string} reason
 * @param {Lock} lock
 */
FilterSet.prototype.failWashing = function(reason, lock)
{
  if (!this.isActive())
  {
    return lock.off();
  }

  var filterSet = this;

  this.setTagValue('.state', false, function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to deactivate on failed washing: %s", err.message
      );
    }
    else
    {
      filterSet.broker.publish('program.filterSets.washingFailed', {
        severity: 'error',
        phase: filterSet.getCurrentPhase(),
        index: filterSet.getIndex(),
        reason: reason
      });

      filterSet.debug(
        "Deactivated due to a failed washing during phase %s: %s",
        filterSet.getCurrentPhase(),
        reason
      );
    }

    return lock.off();
  });
};

/**
 * @returns {number}
 */
FilterSet.prototype.getCurrentPhaseEndTime = function()
{
  var phase = this.getCurrentPhase();
  var phaseDuration = this.getTagValue('filterSets.' + phase + 'Time');

  if (typeof phaseDuration !== 'number')
  {
    return 0;
  }

  var lastPhaseChangeTime = this.getLastPhaseChangeTime();

  return lastPhaseChangeTime + phaseDuration * 1000;
};

FilterSet.prototype.finishWashing = function()
{
  this.broker.publish('program.filterSets.washingFinished', {
    index: this.getIndex()
  });

  var filterSet = this;

  this.setTagValue('.lastWashTime', Date.now(), function(err)
  {
    if (err)
    {
      filterSet.error("Failed to reset the last wash time: %s", err.message);
    }
  });

  this.setTagValue('.flowSinceLastWash', 0, function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to reset the flow since the last wash: %s", err.message
      );
    }
  });

  this.setTagValue('.timeSinceLastWash', 0, function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to reset the treatment time since the last wash: %s",
        err.message
      );
    }
  });
};

/**
 * @param {number} delay
 */
FilterSet.prototype.scheduleNextManageTimer = function(delay)
{
  clearTimeout(this.timers.manage);

  this.timers.manage = setTimeout(this.execManageFilterSet, delay);
};

/**
 * @private
 */
FilterSet.prototype.manageFilterSet = function()
{
  var lock = this.lock('manageFilterSet');

  if (lock.isLocked())
  {
    lock.cb = this.execManageFilterSet;

    return;
  }

  lock.on();

  if ((!this.isActive() || this.isManualMode())
    && !this.isInPhase(FilterSetPhase.TREATMENT_WAIT))
  {
    return this.changePhase(FilterSetPhase.TREATMENT_WAIT, lock);
  }

  var currentPhase = this.getCurrentPhase();

  if (currentPhase === this.currentPhase)
  {
    return this.enterPhase(currentPhase, false, lock);
  }

  if (this.currentPhase === null)
  {
    this.debug("Entered phase %s.", currentPhase);

    this.currentPhase = currentPhase;

    return this.enterPhase(currentPhase, true, lock);
  }

  var filterSet = this;

  this.leavePhase(this.currentPhase, function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to leave the %s phase: %s", filterSet.currentPhase, err.message
      );

      return lock.off();
    }

    filterSet.debug(
      "Entered the %s phase from the %s phase.",
      currentPhase,
      filterSet.currentPhase
    );

    filterSet.currentPhase = currentPhase;

    filterSet.updateLastPhaseChangeTime(function()
    {
      filterSet.enterPhase(currentPhase, true, lock);
    });
  });
};

/**
 * @private
 * @param {FilterSetPhase} phase
 * @param {function(Error|null)} done
 */
FilterSet.prototype.leavePhase = function(phase, done)
{
  filterSetPhases[phase].leave.call(this, done);
};

/**
 * @private
 * @param {FilterSetPhase} phase
 * @param {boolean} phaseChanged
 * @param {Lock} lock
 */
FilterSet.prototype.enterPhase = function(phase, phaseChanged, lock)
{
  var filterSet = this;
  var filterSetPhase = filterSetPhases[phase];

  if (!phaseChanged && this.isManualMode())
  {
    return filterSetPhase.enter.call(filterSet, lock);
  }

  this.openValves(filterSetPhase.valves, function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to open valves %s: %s",
        filterSetPhase.valves.join(', '),
        err.message
      );
    }

    filterSetPhase.enter.call(filterSet, lock);
  });
};

/**
 * @private
 */
FilterSet.prototype.updateFlowSinceLastWash = function()
{
  if (!this.isInPhase(FilterSetPhase.TREATMENT))
  {
    return;
  }

  var inputFlowTag =
    this.modbus.tags[this.getTagName('inputFlow.total.forwards')];

  if (inputFlowTag.oldValue === null)
  {
    return;
  }

  var diff = inputFlowTag.getValue() - inputFlowTag.oldValue;

  if (diff <= 0)
  {
    return;
  }

  var total = this.getFlowSinceLastWash() + diff;
  var filterSet = this;

  this.setTagValue('.flowSinceLastWash', total, function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to increase the flow since last wash by %d m3 to %d m3: %s",
        diff,
        total,
        err.message
      );
    }
  });
};

/**
 * @private
 * @param {function(Error|null)} done
 */
FilterSet.prototype.updateTimeSinceLastWash = function(done)
{
  var diff =
    Math.round((Date.now() - this.getLastPhaseChangeTime()) / 1000);
  var total = this.getTimeSinceLastWash() + diff;
  var filterSet = this;

  this.setTagValue('.timeSinceLastWash', total, function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to increase the time since last wash by %d s to %d s: %s",
        diff,
        total,
        err.message
      );
    }
    else
    {
      filterSet.debug(
        "Increased the time since last wash by %d s to %d s.", diff, total
      );
    }

    done(err);
  });
};

/**
 * @private
 */
FilterSet.prototype.updateLastPhaseChangeTime = function(done)
{
  var filterSet = this;

  this.setTagValue('.lastPhaseChangeTime', Date.now(), function(err)
  {
    if (err)
    {
      filterSet.error(
        "Failed to update the last phase change time: %s", err.message
      );
    }

    done(err);
  });
};
