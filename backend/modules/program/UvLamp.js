'use strict';

var util = require('util');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var ControllableControlUnit = require('./ControllableControlUnit');

module.exports = UvLamp;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 */
function UvLamp(broker, modbus, program)
{
  ControlUnit.call(this, broker, modbus, program, 'uvLamp', -1);

  /**
   * @private
   * @type {number}
   */
  this.outputFlowAt = -1;

  /**
   * @private
   * @type {number}
   */
  this.noOutputFlowAt = -1;

  /**
   * @private
   * @type {object.<string, *>}
   */
  this.timers = {};

  this.watch(
    [
      '.state',
      '.mode',
      '.status',
      'outputFlow'
    ],
    'manageUvLamp'
  );
}

util.inherits(UvLamp, ControlUnit);
lodash.extend(UvLamp.prototype, ControllableControlUnit);

/**
 * @returns {boolean}
 */
UvLamp.prototype.isActive = function()
{
  return !!this.getTagValue('.state');
};

/**
 * @returns {boolean}
 */
UvLamp.prototype.getMode = function()
{
  return !!this.getTagValue('.mode');
};

/**
 * @returns {boolean}
 */
UvLamp.prototype.isManualMode = function()
{
  return !this.getMode();
};

/**
 * @returns {boolean}
 */
UvLamp.prototype.isAutoMode = function()
{
  return this.getMode();
};

/**
 * @returns {number}
 */
UvLamp.prototype.getStartDelay = function()
{
  return (this.getTagValue('.startDelay') || 0) * 1000 + 1;
};

/**
 * @returns {number}
 */
UvLamp.prototype.getStopDelay = function()
{
  return (this.getTagValue('.stopDelay') || 0) * 1000 + 1;
};

/**
 * @returns {boolean}
 */
UvLamp.prototype.isStarted = function()
{
  return !!this.getTagValue('.control');
};

/**
 * @returns {boolean}
 */
UvLamp.prototype.isOutputWaterFlowing = function()
{
  return this.getTagValue('outputFlow') > 0;
};

/**
 * @private
 */
UvLamp.prototype.manageUvLamp = function()
{
  var lock = this.lock('manageUvLamp');

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

  if (this.isOutputWaterFlowing())
  {
    this.noOutputFlowAt = -1;

    if (this.isStarted())
    {
      return lock.off();
    }

    return this.handleOutputFlow(lock);
  }

  this.outputFlowAt = -1;

  if (!this.isStarted())
  {
    return lock.off();
  }
  
  this.handleNoOutputFlow(lock);
};

/**
 * @private
 * @param {Lock} lock
 */
UvLamp.prototype.handleOutputFlow = function(lock)
{
  if (this.outputFlowAt === -1)
  {
    this.debug("Output water started to flow...");

    this.outputFlowAt = Date.now();
  }

  if (this.hasOutputFlowStabilized())
  {
    this.debug("...output flow stabilized.");

    var controlUnit = this;

    return this.start(function(err, unchanged)
    {
      if (err)
      {
        controlUnit.error("Failed to start: %s", err.message);
      }
      else if (!unchanged)
      {
        controlUnit.debug("Started: output water flow.");
      }

      lock.off();
    });
  }

  //this.debug("...output flow not stabilized yet...");

  lock.off();
};

/**
 * @private
 * @param {Lock} lock
 */
UvLamp.prototype.handleNoOutputFlow = function(lock)
{
  if (this.noOutputFlowAt === -1)
  {
    this.debug("Output water stopped flowing...");

    this.noOutputFlowAt = Date.now();
  }

  if (this.hasNoOutputFlowStabilized())
  {
    this.debug("...no output flow stabilized.");

    var controlUnit = this;

    return this.stop(function(err, unchanged)
    {
      if (err)
      {
        controlUnit.error("Failed to stop: %s", err.message);
      }
      else if (!unchanged)
      {
        controlUnit.debug("Stopped: no output flow.");
      }

      lock.off();
    });
  }

  //this.debug("...no output flow not stabilized yet...");

  lock.off();
};

/**
 * @private
 * @returns {boolean}
 */
UvLamp.prototype.hasOutputFlowStabilized = function()
{
  var diff = Date.now() - this.outputFlowAt;
  var stabilizationTime = this.getStartDelay();

  if (diff < stabilizationTime)
  {
    this.scheduleNextManageTimer('startDelay', stabilizationTime - diff);

    return false;
  }

  return true;
};

/**
 * @private
 * @returns {boolean}
 */
UvLamp.prototype.hasNoOutputFlowStabilized = function()
{
  var diff = Date.now() - this.noOutputFlowAt;
  var stabilizationTime = this.getStopDelay();

  if (diff < stabilizationTime)
  {
    this.scheduleNextManageTimer('stopDelay', stabilizationTime - diff);

    return false;
  }

  return true;
};

/**
 * @private
 * @param {string} id
 * @param {number} delay
 */
UvLamp.prototype.scheduleNextManageTimer = function(id, delay)
{
  if (!lodash.isUndefined(this.timers[id]))
  {
    return;
  }

  function removeTimerAndManage(uvLamp, id)
  {
    delete uvLamp.timers[id];

    uvLamp.manageUvLamp();
  }

  this.timers[id] = setTimeout(removeTimerAndManage, delay, this, id);
};
