'use strict';

var FilterSetValve = require('../FilterSetValve');
var FilterSetPhase = require('../FilterSetPhase');

exports.valves = [
  FilterSetValve.WASHINGS,
  FilterSetValve.DRAIN
];

/**
 * @this FilterSet
 * @param {Lock} lock
 */
exports.enter = function(lock)
{
  var filterSet = this;

  if (filterSet.isSettlerMaxReached())
  {
    return filterSet.failWashing('SETTLER_MAX_REACHED', lock);
  }

  var phaseEndTime = filterSet.getCurrentPhaseEndTime();
  var currentTime = Date.now();

  if (currentTime < phaseEndTime)
  {
    filterSet.scheduleNextManageTimer(phaseEndTime - currentTime + 100);

    return lock.off();
  }

  filterSet.changePhase(FilterSetPhase.BLOWING, lock);
};

/**
 * @this FilterSet
 * @param {function(Error|null)} done
 */
exports.leave = function(done)
{
  done(null);
};
