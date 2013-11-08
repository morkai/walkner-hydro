'use strict';

var util = require('util');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var FilterSetValve = require('./FilterSetValve');
var FilterSetPhase = require('./FilterSetPhase');
var FilterSet = require('./FilterSet');

module.exports = FilterSets;

/**
 * @constructor
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 */
function FilterSets(broker, modbus, program)
{
  ControlUnit.call(this, broker, modbus, program, 'filterSets');

  /**
   * @private
   * @type {object.<number, FilterSet>}
   */
  this.filterSets = {};

  for (var i = 1; i <= program.config.filterSetCount; ++i)
  {
    this.filterSets[i] = new FilterSet(broker, modbus, program, i);
  }

  this.watch(
    [
      '.*.state',
      '.*.mode',
      '.*.currentPhase'
    ],
    'manageFilterSets'
  );
}

util.inherits(FilterSets, ControlUnit);

FilterSets.prototype.toJSON = function()
{
  return Object.keys(this.filterSets).length;
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.isAnyActive = function()
{
  return lodash.some(this.filterSets, function(filterSet)
  {
    return filterSet.isActive();
  });
};

/**
 * @param {FilterSetPhase} phase
 * @returns {boolean}
 */
FilterSets.prototype.isAnyInPhase = function(phase)
{
  return lodash.some(this.filterSets, function(filterSet)
  {
    return filterSet.isInPhase(phase);
  });
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.isAnyTreating = function()
{
  return this.isAnyInPhase(FilterSetPhase.TREATMENT);
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.isAnyWaitingForWashing = function()
{
  return this.isAnyInPhase(FilterSetPhase.WASHING_WAIT);
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.isAnyBlowing = function()
{
  return this.isAnyInPhase(FilterSetPhase.BLOWING);
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.isAnyRinsing = function()
{
  return this.isAnyInPhase(FilterSetPhase.RINSING);
};

/**
 * @param {FilterSet} thatFilterSet
 * @returns {boolean}
 */
FilterSets.prototype.isAnyOtherWashing = function(thatFilterSet)
{
  return lodash.some(this.filterSets, function(otherFilterSet)
  {
    return otherFilterSet !== thatFilterSet
      && !otherFilterSet.isInPhase(FilterSetPhase.TREATMENT)
      && !otherFilterSet.isInPhase(FilterSetPhase.TREATMENT_WAIT);
  });
};

/**
 * @param {Array.<FilterSetValve>} valves
 * @returns {boolean}
 */
FilterSets.prototype.areAnyValvesOpen = function(valves)
{
  return lodash.some(this.filterSets, function(filterSet)
  {
    return filterSet.areValvesOpen(valves);
  });
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.areAnyWaterTreatingValvesOpen = function()
{
  return this.areAnyValvesOpen([
    FilterSetValve.RAW_WATER,
    FilterSetValve.CLEAN_WATER
  ]);
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.areAnyBlowingValvesOpen = function()
{
  return this.areAnyValvesOpen([
    FilterSetValve.WASHINGS,
    FilterSetValve.AIR
  ]);
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.areAnyRinsingValvesOpen = function()
{
  return this.areAnyValvesOpen([
    FilterSetValve.WASHINGS,
    FilterSetValve.WASHING_WATER
  ]);
};

/**
 * @returns {boolean}
 */
FilterSets.prototype.areAnyDrainingValvesOpen = function()
{
  return this.areAnyValvesOpen([
    FilterSetValve.WASHINGS,
    FilterSetValve.DRAIN
  ]);
};

/**
 * @private
 */
FilterSets.prototype.manageFilterSets = function()
{
  var lock = this.lock('manageFilterSets');

  if (lock.isLocked())
  {
    return;
  }

  lock.on();

  if (this.isAnyTreating())
  {
    return lock.off();
  }

  var filterSet = this.getNextFilterSetForTreatment();

  if (filterSet === null)
  {
    this.error("No filter set available for water treatment!");

    return lock.off();
  }

  filterSet.changePhase(FilterSetPhase.TREATMENT, lock);
};

/**
 * @private
 * @returns {FilterSet|null}
 */
FilterSets.prototype.getNextFilterSetForTreatment = function()
{
  var waitingFilterSets = lodash.filter(this.filterSets, function(filterSet)
  {
    return filterSet.isActive()
      && filterSet.isAutoMode()
      && filterSet.isInPhase(FilterSetPhase.TREATMENT_WAIT);
  });

  if (waitingFilterSets.length === 0)
  {
    return null;
  }

  waitingFilterSets.sort(function(a, b)
  {
    return b.getFlowSinceLastWash() - a.getFlowSinceLastWash();
  });

  return waitingFilterSets[0];
};
