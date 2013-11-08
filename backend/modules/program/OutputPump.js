'use strict';

var util = require('util');
var lodash = require('lodash');
var step = require('h5.step');
var ControlUnit = require('./ControlUnit');
var ControllableControlUnit = require('./ControllableControlUnit');

module.exports = OutputPump;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 * @param {number} index
 */
function OutputPump(broker, modbus, program, index)
{
  ControlUnit.call(this, broker, modbus, program, 'outputPumps', index);

  /**
   * @private
   * @type {number}
   */
  this.startedAt = -1;

  this.watch('.status', 'updateWorkTime');
  this.watch(
    [
      '.switch',
      '.state',
      '.mode',
      '.status',
      '.failure'
    ],
    'manageOutputPump'
  );
}

util.inherits(OutputPump, ControlUnit);
lodash.extend(OutputPump.prototype, ControllableControlUnit);

/**
 * @returns {boolean}
 */
OutputPump.prototype.getSwitch = function()
{
  return !!this.getTagValue('.switch');
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isActive = function()
{
  return !!this.getTagValue('.state');
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.getMode = function()
{
  return !!this.getTagValue('.mode');
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isStarted = function()
{
  return this.isStartedByGrid() || this.isStartedByVfd();
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isStartedByGrid = function()
{
  return !!this.getTagValue('.control.grid');
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isStartedByVfd = function()
{
  return !!this.getTagValue('.control.vfd');
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isRunning = function()
{
  return !!this.getTagValue('.status');
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isRunningThroughVfd = function()
{
  return !!this.getTagValue('.status.vfd');
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isRunningThroughGrid = function()
{
  return !!this.getTagValue('.status.grid');
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isFailure = function()
{
  return !!this.getTagValue('.failure');
};

/**
 * @returns {number|null}
 */
OutputPump.prototype.getWaterLevel = function()
{
  return this.getTagValue('.waterLevel');
};

/**
 * @returns {number|null}
 */
OutputPump.prototype.getDepth = function()
{
  return this.getTagValue('.depth');
};

/**
 * @returns {number}
 */
OutputPump.prototype.getWorkTime = function()
{
  return this.getTagValue('.workTime') || 0;
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isHandMode = function()
{
  return !this.getSwitch() && this.isRunning();
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isManualMode = function()
{
  return this.getSwitch() && !this.getMode();
};

/**
 * @returns {boolean}
 */
OutputPump.prototype.isAutoMode = function()
{
  return this.getSwitch() && this.getMode();
};

/**
 * @param {string} type
 * @param {function(Error|null)} [done]
 */
OutputPump.prototype.start = function(type, done)
{
  if (!lodash.isFunction(done))
  {
    done = function() {};
  }

  var outputPump = this;

  this.control(type, true, function(err, unchanged)
  {
    if (err)
    {
      return done(err);
    }

    if (type !== 'vfd')
    {
      return done(null, unchanged);
    }

    outputPump.setTagValue('outputPumps.control', true, function(err)
    {
      done(err, unchanged);
    });
  });
};

/**
 * @param {function(Error|null, boolean)} [done]
 */
OutputPump.prototype.stop = function(done)
{
  if (!lodash.isFunction(done))
  {
    done = function() {};
  }

  if (this.isStartedByGrid())
  {
    return this.control('grid', false, done);
  }

  if (!this.isStartedByVfd())
  {
    return done(null, true);
  }

  var outputPump = this;

  step(
    function turnOffVfdStep()
    {
      outputPump.setTagValue('outputPumps.control', false, this.next());
    },
    function zeroPresetRefStep(err)
    {
      if (err)
      {
        return this.done(done, err);
      }

      outputPump.setTagValue('outputPumps.presetRef', 0, this.next());
    },
    function waitForOutputFreqStep(err)
    {
      if (err)
      {
        return this.done(done, err);
      }

      outputPump.ackTagValue(
        'outputPumps.outputFrequency', 0, 10000, this.next()
      );
    },
    function turnOffVfdContactorStep()
    {
      outputPump.control('vfd', false, this.next());
    },
    done
  );
};

/**
 * @private
 * @param {string} type
 * @param {boolean} newStatus
 * @param {function(Error|null, boolean)} done
 */
OutputPump.prototype.control = function(type, newStatus, done)
{
  if (newStatus === this.getTagValue('.control.' + type))
  {
    return done(null, true);
  }

  var outputPump = this;

  this.setTagValue('.control.' + type, newStatus, function(err)
  {
    if (err)
    {
      return done(err);
    }

    outputPump.ackTagValue('.status.' + type, newStatus, done);
  });
};

/**
 * @private
 */
OutputPump.prototype.updateWorkTime = function()
{
  if (this.isRunning())
  {
    this.startedAt = Date.now();
  }
  else if (this.startedAt !== -1)
  {
    var currentWorkTime = this.getTagValue('.workTime');
    var workTime = (Date.now() - this.startedAt) / 1000;
    var newWorkTime = Math.round((currentWorkTime + workTime) * 1000) / 1000;
    var controlUnit = this;

    this.startedAt = -1;

    this.setTagValue('.workTime', newWorkTime, function(err)
    {
      if (err)
      {
        controlUnit.error("Failed to update the work time: %s", err.message);
      }
      else
      {
        controlUnit.debug(
          "Updated the work time by %ds to %ds.", workTime, newWorkTime
        );
      }
    });
  }
};

/**
 * @private
 */
OutputPump.prototype.manageOutputPump = function()
{
  var lock = this.lock('manageOutputPump');

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

  lock.off();
};
