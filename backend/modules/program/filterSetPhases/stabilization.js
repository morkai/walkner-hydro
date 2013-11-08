'use strict';

var FilterSetValve = require('../FilterSetValve');
var FilterSetPhase = require('../FilterSetPhase');

exports.valves = [
  FilterSetValve.WASHINGS,
  FilterSetValve.AIR
];

/**
 * @this FilterSet
 * @param {Lock} lock
 */
exports.enter = function(lock)
{
  var filterSet = this;

  var phaseEndTime = filterSet.getCurrentPhaseEndTime();
  var currentTime = Date.now();

  if (currentTime >= phaseEndTime)
  {
    return filterSet.changePhase(FilterSetPhase.RINSING, lock);
  }

  filterSet.scheduleNextManageTimer(phaseEndTime - currentTime + 100);

  lock.off();
};

/**
 * @this FilterSet
 * @param {function(Error|null)} done
 */
exports.leave = function(done)
{
  done(null);
};
