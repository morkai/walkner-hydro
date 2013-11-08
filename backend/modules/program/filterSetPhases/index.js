'use strict';

var FilterSetPhase = require('../FilterSetPhase');

exports[FilterSetPhase.TREATMENT] = require('./treatment');
exports[FilterSetPhase.TREATMENT_WAIT] = require('./treatmentWait');
exports[FilterSetPhase.WASHING_WAIT] = require('./washingWait');
exports[FilterSetPhase.DRAINING] = require('./draining');
exports[FilterSetPhase.BLOWING] = require('./blowing');
exports[FilterSetPhase.STABILIZATION] = require('./stabilization');
exports[FilterSetPhase.RINSING] = require('./rinsing');
