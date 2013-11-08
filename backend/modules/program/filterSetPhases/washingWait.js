'use strict';

var FilterSetValve = require('../FilterSetValve');
var FilterSetPhase = require('../FilterSetPhase');

exports.valves = [
  FilterSetValve.RAW_WATER,
  FilterSetValve.CLEAN_WATER
];

/**
 * @this FilterSet
 * @param {Lock} lock
 */
exports.enter = function(lock)
{
  var filterSet = this;

  var reason = filterSet.canWash();

  if (reason !== null)
  {
    filterSet.debug("Cannot wash: %s.", reason);

    return lock.off();
  }

  if (!filterSet.isEnoughWaterForWashingAvailable())
  {
    filterSet.debug("Refilling the reservoirs...");

    return lock.off();
  }

  filterSet.changePhase(FilterSetPhase.DRAINING, lock);
};

/**
 * @this FilterSet
 * @param {function(Error|null)} done
 */
exports.leave = function(done)
{
  done(null);
};
