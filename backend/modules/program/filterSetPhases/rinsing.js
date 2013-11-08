'use strict';

var FilterSetValve = require('../FilterSetValve');
var FilterSetPhase = require('../FilterSetPhase');

exports.valves = [
  FilterSetValve.WASHINGS,
  FilterSetValve.WASHING_WATER
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
    filterSet.finishWashing();
    filterSet.changePhase(FilterSetPhase.TREATMENT_WAIT, lock);

    return;
  }

  filterSet.ackTagValue('washingPump.status', true, function(err)
  {
    if (err)
    {
      filterSet.failWashing('WASHING_PUMP_FAILED', lock);
    }
    else
    {
      filterSet.scheduleNextManageTimer(phaseEndTime - currentTime + 100);

      lock.off();
    }
  });
};

/**
 * @this FilterSet
 * @param {function(Error|null)} done
 */
exports.leave = function(done)
{
  done(null);
};
