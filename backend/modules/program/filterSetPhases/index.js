// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var FilterSetPhase = require('../FilterSetPhase');

exports[FilterSetPhase.TREATMENT] = require('./treatment');
exports[FilterSetPhase.TREATMENT_WAIT] = require('./treatmentWait');
exports[FilterSetPhase.WASHING_WAIT] = require('./washingWait');
exports[FilterSetPhase.DRAINING] = require('./draining');
exports[FilterSetPhase.BLOWING] = require('./blowing');
exports[FilterSetPhase.STABILIZATION] = require('./stabilization');
exports[FilterSetPhase.RINSING] = require('./rinsing');
