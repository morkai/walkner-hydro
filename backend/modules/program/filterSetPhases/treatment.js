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

  if (!filterSet.isInWashingTimeFrame())
  {
    var washingTimeFrameStart = filterSet.getNextWashingTimeFrameStartTime();

    if (filterSet.washingTimeFrameStart !== washingTimeFrameStart)
    {
      filterSet.debug(
        "Not in washing time frame: scheduled the next check to be at %s.",
        new Date(washingTimeFrameStart)
      );

      filterSet.washingTimeFrameStart = washingTimeFrameStart;
    }

    filterSet.scheduleNextManageTimer(washingTimeFrameStart - Date.now() + 100);

    return lock.off();
  }

  if (!filterSet.shouldWash())
  {
    var timeToMaxWashAfterHours = filterSet.getTimeToMaxWashAfterHours();

    if (filterSet.timeToMaxWashAfterHours !== timeToMaxWashAfterHours)
    {
      filterSet.debug(
        "Washing criteria not met yet: scheduled the next check to be at %s.",
        new Date(timeToMaxWashAfterHours)
      );

      filterSet.timeToMaxWashAfterHours = timeToMaxWashAfterHours;
    }

    filterSet.scheduleNextManageTimer(
      timeToMaxWashAfterHours - Date.now() + 100
    );

    return lock.off();
  }

  var reason = filterSet.canWash();

  if (reason !== null)
  {
    filterSet.debug("Cannot wash: %s.", reason);

    return lock.off();
  }

  filterSet.changePhase(FilterSetPhase.WASHING_WAIT, lock);
};

/**
 * @this FilterSet
 * @param {function(Error|null)} done
 */
exports.leave = function(done)
{
  var filterSet = this;

  filterSet.updateTimeSinceLastWash(done);

  filterSet.washingTimeFrameStart = -1;
  filterSet.timeToMaxWashAfterHours = -1;
};
