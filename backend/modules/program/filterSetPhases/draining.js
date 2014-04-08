// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
