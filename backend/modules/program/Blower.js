// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var util = require('util');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var ControllableControlUnit = require('./ControllableControlUnit');

module.exports = Blower;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 */
function Blower(broker, modbus, program)
{
  ControlUnit.call(this, broker, modbus, program, 'blower', -1);

  this.watch(
    [
      '.switch',
      '.state',
      '.mode',
      '.status',
      '.failure',
      'filterSets.*.currentPhase',
      'filterSets.*.valves.2.status',
      'filterSets.*.valves.4.status'
    ],
    'manageBlower'
  );
}

util.inherits(Blower, ControlUnit);
lodash.extend(Blower.prototype, ControllableControlUnit);

/**
 * @returns {boolean}
 */
Blower.prototype.getSwitch = function()
{
  return !!this.getTagValue('.switch');
};

/**
 * @returns {boolean}
 */
Blower.prototype.isActive = function()
{
  return !!this.getTagValue('.state');
};

/**
 * @returns {boolean}
 */
Blower.prototype.getMode = function()
{
  return !!this.getTagValue('.mode');
};

/**
 * @returns {boolean}
 */
Blower.prototype.isStarted = function()
{
  return !!this.getTagValue('.control');
};

/**
 * @returns {boolean}
 */
Blower.prototype.isRunning = function()
{
  return !!this.getTagValue('.status');
};

/**
 * @returns {boolean}
 */
Blower.prototype.isFailure = function()
{
  return !!this.getTagValue('.failure');
};

/**
 * @returns {boolean}
 */
Blower.prototype.isHandMode = function()
{
  return !this.getSwitch() && this.isRunning();
};

/**
 * @returns {boolean}
 */
Blower.prototype.isManualMode = function()
{
  return this.getSwitch() && !this.getMode();
};

/**
 * @returns {boolean}
 */
Blower.prototype.isAutoMode = function()
{
  return this.getSwitch() && this.getMode();
};

/**
 * @returns {boolean}
 */
Blower.prototype.isAvailable = function()
{
  return this.isActive() && this.isAutoMode() && !this.isFailure();
};

/**
 * @private
 */
Blower.prototype.manageBlower = function()
{
  var lock = this.lock('manageBlower');

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

  if (this.isFailure())
  {
    return this.stopWithReason("failure", lock);
  }

  var filterSets = this.program.filterSets;

  if (!filterSets.isAnyBlowing())
  {
    return this.stopWithReason("no filter set blowing", lock);
  }

  if (!filterSets.areAnyBlowingValvesOpen())
  {
    return this.stopWithReason("no blowing valves open", lock);
  }

  var blower = this;

  this.start(function(err, unchanged)
  {
    if (err)
    {
      blower.error("Failed to start: %s", err.message);
    }
    else if (!unchanged)
    {
      blower.debug("Started with a blowing filter set.");
    }

    lock.off();
  });
};
