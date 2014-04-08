// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

/**
 * @name FilterSetPhase
 * @enum {string}
 */
module.exports = {
  TREATMENT: 'treatment',
  TREATMENT_WAIT: 'treatmentWait',
  WASHING_WAIT: 'washingWait',
  DRAINING: 'draining',
  BLOWING: 'blowing',
  STABILIZATION: 'stabilization',
  RINSING: 'rinsing'
};
