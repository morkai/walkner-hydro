'use strict';

var lodash = require('lodash');

var ControllableControlUnit = module.exports = {};

/**
 * @returns {boolean}
 */
ControllableControlUnit.isStarted = function()
{
  return !!this.getTagValue('.control');
};

/**
 * @param {function(Error|null, boolean)} done
 */
ControllableControlUnit.start = function(done)
{
  this.control(true, done);
};

/**
 * @param {function(Error|null, boolean)} done
 */
ControllableControlUnit.stop = function(done)
{
  this.control(false, done);
};

/**
 * @param {string} reason
 * @param {Lock} lock
 */
ControllableControlUnit.stopWithReason = function(reason, lock)
{
  var controlUnit = this;

  this.stop(function(err, unchanged)
  {
    if (err)
    {
      controlUnit.error("Failed to stop (%s): %s", reason, err.message);
    }
    else if (!unchanged)
    {
      controlUnit.debug("Stopped: %s.", reason);
    }

    lock.off();
  });
};

/**
 * @param {boolean} newStatus
 * @param {function(Error|null, boolean)} done
 */
ControllableControlUnit.control = function(newStatus, done)
{
  if (!lodash.isFunction(done))
  {
    done = function() {};
  }

  if (newStatus === this.isStarted())
  {
    return done(null, true);
  }

  var controlUnit = this;

  this.setTagValue('.control', newStatus, function(err)
  {
    if (err)
    {
      return done(err);
    }

    controlUnit.ackTagValue('.status', newStatus, done);
  });
};
