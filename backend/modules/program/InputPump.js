// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var util = require('util');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var ControllableControlUnit = require('./ControllableControlUnit');

var CLOSED_VALVE_CURRENT = 10;
var CLOSED_VALVE_TIME = 60 * 1000;

module.exports = InputPump;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 * @param {number} index
 */
function InputPump(broker, modbus, program, index)
{
  ControlUnit.call(this, broker, modbus, program, 'inputPumps', index);

  this.watch('.status', 'updateLastUseTime');
  this.watch(
    [
      '.switch',
      '.state',
      '.mode',
      '.status',
      '.failure',
      '.dryRunLed',
      '.dryRunWaterLevel',
      '.waterLevel',
      '.current'
    ],
    'manageInputPump'
  );
}

util.inherits(InputPump, ControlUnit);
lodash.extend(InputPump.prototype, ControllableControlUnit);

/**
 * @returns {boolean}
 */
InputPump.prototype.getSwitch = function()
{
  return !!this.getTagValue('.switch');
};

/**
 * @returns {boolean}
 */
InputPump.prototype.isActive = function()
{
  return !!this.getTagValue('.state');
};

/**
 * @returns {boolean}
 */
InputPump.prototype.getMode = function()
{
  return !!this.getTagValue('.mode');
};

/**
 * @returns {boolean}
 */
InputPump.prototype.isRunning = function()
{
  return !!this.getTagValue('.status');
};

/**
 * @returns {boolean}
 */
InputPump.prototype.isFailure = function()
{
  return !!this.getTagValue('.failure');
};

/**
 * @returns {number|null}
 */
InputPump.prototype.getWaterLevel = function()
{
  return this.getTagValue('.waterLevel');
};

/**
 * @returns {number|null}
 */
InputPump.prototype.getDryRunWaterLevel = function()
{
  return this.getTagValue('.dryRunWaterLevel');
};

/**
 * @returns {number|null}
 */
InputPump.prototype.getCurrent = function()
{
  return this.getTagValue('.current');
};

/**
 * @returns {boolean}
 */
InputPump.prototype.isDryRun = function()
{
  var waterLevel = this.getWaterLevel();
  var dryRunWaterLevel = this.getDryRunWaterLevel();

  if (waterLevel === null)
  {
    return true;
  }

  if (dryRunWaterLevel === null)
  {
    return false;
  }

  return waterLevel > dryRunWaterLevel;
};

/**
 * @returns {number|null}
 */
InputPump.prototype.getDepth = function()
{
  return this.getTagValue('.depth');
};

/**
 * @returns {number|null}
 */
InputPump.prototype.getSensorDepth = function()
{
  return this.getTagValue('.depth.sensor');
};

/**
 * @returns {number|null}
 */
InputPump.prototype.getSensorOffset = function()
{
  return this.getTagValue('.depth.offset');
};

/**
 * @returns {number}
 */
InputPump.prototype.getLastUseTime = function()
{
  return this.getTagValue('.lastUseTime') || 0;
};

/**
 * @returns {number}
 */
InputPump.prototype.getLastStatusChangeTime = function()
{
  return this.getLastTagChangeTime('.status');
};

/**
 * @returns {boolean}
 */
InputPump.prototype.isHandMode = function()
{
  return !this.getSwitch() && this.isRunning();
};

/**
 * @returns {boolean}
 */
InputPump.prototype.isManualMode = function()
{
  return this.getSwitch() && !this.getMode();
};

/**
 * @returns {boolean}
 */
InputPump.prototype.isAutoMode = function()
{
  return this.getSwitch() && this.getMode();
};

/**
 * @returns {boolean}
 */
InputPump.prototype.isValveClosed = function()
{
  var lastControlChangeTime =
    Date.now() - this.getLastTagChangeTime('.control');

  return this.isStarted()
    && this.getCurrent() < CLOSED_VALVE_CURRENT
    && lastControlChangeTime >= CLOSED_VALVE_TIME;
};

/**
 * @private
 * @param {boolean} newState
 * @param {function(Error|null)} done
 */
InputPump.prototype.setDryRunLed = function(newState, done)
{
  this.setTagValue('.dryRunLed', newState, done);
};

/**
 * @private
 */
InputPump.prototype.updateLastUseTime = function()
{
  if (this.isRunning())
  {
    return;
  }

  var inputPump = this;

  this.setTagValue('.lastUseTime', Date.now(), function(err)
  {
    if (err)
    {
      inputPump.error(
        "Failed to update the last use time of the input pump %d: %s",
        inputPump.getIndex(),
        err.message
      );
    }
  });
};

/**
 * @private
 */
InputPump.prototype.manageInputPump = function()
{
  var lock = this.lock('manageInputPump');

  if (lock.isLocked())
  {
    return;
  }

  lock.on();

  if (this.isDryRun())
  {
    return this.handleDryRun(lock);
  }

  var inputPump = this;

  this.setDryRunLed(false, function(err, unchanged)
  {
    if (err)
    {
      inputPump.error("Failed to turn off the dry run LED: %s", err.message);
    }
    else if (!unchanged)
    {
      inputPump.debug("Turned off the dry run LED.");
    }

    if (!inputPump.isActive())
    {
      return inputPump.stopWithReason("deactivation", lock);
    }

    if (!inputPump.isAutoMode())
    {
      if (inputPump.isManualMode())
      {
        return lock.off();
      }

      return inputPump.stopWithReason("0-hand", lock);
    }

    if (inputPump.isFailure())
    {
      return inputPump.stopWithReason("failure", lock);
    }

    if (inputPump.isValveClosed())
    {
      return inputPump.setTagValue('.state', false, function(err)
      {
        if (err)
        {
          inputPump.error(
            "Failed to deactivate because of a closed valve: %s", err.message
          );
        }
        else
        {
          inputPump.debug("Deactivated because of a closed valve.");
        }

        inputPump.stopWithReason("closed valve", lock);
      });
    }

    lock.off();
  });
};

/**
 * @private
 * @param {Lock} lock
 */
InputPump.prototype.handleDryRun = function(lock)
{
  var inputPump = this;

  this.setDryRunLed(true, function(err, unchanged)
  {
    if (err)
    {
      inputPump.error("Failed to turn on the dry run LED: %s", err.message);
    }
    else if (!unchanged)
    {
      inputPump.debug("Turned on the dry run LED.");
    }

    if (!inputPump.isActive())
    {
      return inputPump.stopWithReason("deactivation", lock);
    }

    if (!inputPump.isManualMode())
    {
      return inputPump.stopWithReason("dry run", lock);
    }

    lock.off();
  });
};
