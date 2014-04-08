// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
