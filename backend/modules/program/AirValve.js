// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var util = require('util');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var ControllableControlUnit = require('./ControllableControlUnit');

module.exports = AirValve;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 */
function AirValve(broker, modbus, program)
{
  ControlUnit.call(this, broker, modbus, program, 'airValve', -1);

  this.watch(
    [
      '.switch',
      '.state',
      '.mode',
      '.status',
      'inputPumps.*.status'
    ],
    'manageAirValve'
  );
}

util.inherits(AirValve, ControlUnit);
lodash.extend(AirValve.prototype, ControllableControlUnit);

/**
 * @returns {boolean}
 */
AirValve.prototype.getSwitch = function()
{
  return !!this.getTagValue('.switch');
};

/**
 * @returns {boolean}
 */
AirValve.prototype.isActive = function()
{
  return !!this.getTagValue('.state');
};

/**
 * @returns {boolean}
 */
AirValve.prototype.getMode = function()
{
  return !!this.getTagValue('.mode');
};

/**
 * @returns {boolean}
 */
AirValve.prototype.isRunning = function()
{
  return !!this.getTagValue('.status');
};

/**
 * @returns {boolean}
 */
AirValve.prototype.isHandMode = function()
{
  return !this.getSwitch() && this.isRunning();
};

/**
 * @returns {boolean}
 */
AirValve.prototype.isManualMode = function()
{
  return this.getSwitch() && !this.getMode();
};

/**
 * @returns {boolean}
 */
AirValve.prototype.isAutoMode = function()
{
  return this.getSwitch() && this.getMode();
};

/**
 * @private
 */
AirValve.prototype.manageAirValve = function()
{
  var lock = this.lock('manageAirValve');

  if (lock.isLocked())
  {
    return;
  }

  lock.on();

  if (!this.isActive())
  {
    return this.stopWithReason("deactivation", lock);
  }

  if (!this.isAutoMode())
  {
    if (this.isManualMode())
    {
      return lock.off();
    }

    return this.stopWithReason("0-hand", lock);
  }

  if (!this.program.inputPumps.isAnyRunning())
  {
    return this.stopWithReason("no input pumps running", lock);
  }

  var airValve = this;

  this.start(function(err, unchanged)
  {
    if (err)
    {
      airValve.error("Failed to start: %s", err.message);
    }
    else if (!unchanged)
    {
      airValve.debug("Started with an input pump.");
    }

    lock.off();
  });
};
