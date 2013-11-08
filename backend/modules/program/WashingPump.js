'use strict';

var util = require('util');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var ControllableControlUnit = require('./ControllableControlUnit');

module.exports = WashingPump;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 */
function WashingPump(broker, modbus, program)
{
  ControlUnit.call(this, broker, modbus, program, 'washingPump', -1);

  this.watch(
    [
      '.switch',
      '.state',
      '.mode',
      '.status',
      'filterSets.*.currentPhase',
      'filterSets.*.valves.2.status',
      'filterSets.*.valves.6.status'
    ],
    'manageWashingPump'
  );
}

util.inherits(WashingPump, ControlUnit);
lodash.extend(WashingPump.prototype, ControllableControlUnit);

/**
 * @returns {boolean}
 */
WashingPump.prototype.getSwitch = function()
{
  return !!this.getTagValue('.switch');
};

/**
 * @returns {boolean}
 */
WashingPump.prototype.isActive = function()
{
  return !!this.getTagValue('.state');
};

/**
 * @returns {boolean}
 */
WashingPump.prototype.getMode = function()
{
  return !!this.getTagValue('.mode');
};

/**
 * @returns {boolean}
 */
WashingPump.prototype.isRunning = function()
{
  return !!this.getTagValue('.status');
};

/**
 * @returns {boolean}
 */
WashingPump.prototype.isFailure = function()
{
  return !!this.getTagValue('.failure');
};

/**
 * @returns {boolean}
 */
WashingPump.prototype.isHandMode = function()
{
  return !this.getSwitch() && this.isRunning();
};

/**
 * @returns {boolean}
 */
WashingPump.prototype.isManualMode = function()
{
  return this.getSwitch() && !this.getMode();
};

/**
 * @returns {boolean}
 */
WashingPump.prototype.isAutoMode = function()
{
  return this.getSwitch() && this.getMode();
};

/**
 * @returns {boolean}
 */
WashingPump.prototype.isAvailable = function()
{
  return this.isActive() && this.isAutoMode() && !this.isFailure();
};

/**
 * @param {function(Error|null, boolean)} done
 */
WashingPump.prototype.start = function(done)
{
  var inputPump2 = this.program.inputPumps.get(2);

  if (inputPump2 && inputPump2.isRunning())
  {
    var washingPump = this;

    inputPump2.stop(function(err)
    {
      if (err)
      {
        return done(
          new Error("failed to stop input pump 2: " + err.message), false
        );
      }

      washingPump.control(true, done);
    });
  }
  else
  {
    this.control(true, done);
  }
};

/**
 * @private
 */
WashingPump.prototype.manageWashingPump = function()
{
  var lock = this.lock('manageWashingPump');

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

  if (!filterSets.isAnyRinsing())
  {
    return this.stopWithReason("no filter set rinsing", lock);
  }

  if (!filterSets.areAnyRinsingValvesOpen())
  {
    return this.stopWithReason("no rinsing valves open", lock);
  }

  var washingPump = this;

  this.start(function(err, unchanged)
  {
    if (err)
    {
      washingPump.error("Failed to start: %s", err.message);
    }
    else if (!unchanged)
    {
      washingPump.debug("Started with a rinsing filter set.");
    }

    lock.off();
  });
};
