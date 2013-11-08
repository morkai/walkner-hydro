'use strict';

var util = require('util');
var lodash = require('lodash');
var ControlUnit = require('./ControlUnit');
var Reservoir = require('./Reservoir');

module.exports = Reservoirs;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 */
function Reservoirs(broker, modbus, program)
{
  ControlUnit.call(this, broker, modbus, program, 'reservoirs', -1);

  /**
   * @private
   * @type {object.<number, Reservoir>}
   */
  this.reservoirs = {};

  for (var i = 1; i <= program.config.reservoirCount; ++i)
  {
    this.reservoirs[i] = new Reservoir(broker, modbus, program, i);
  }
}

util.inherits(Reservoirs, ControlUnit);

/**
 * @returns {boolean}
 */
Reservoirs.prototype.isAnyActive = function()
{
  return lodash.some(this.reservoirs, function(reservoir)
  {
    return reservoir.isActive();
  });
};

/**
 * @return {boolean}
 */
Reservoirs.prototype.isMaxWaterLevelReached = function()
{
  var result = false;

  lodash.each(this.reservoirs, function(reservoir)
  {
    result = reservoir.isActive() && reservoir.isMaxWaterLevelReached();

    if (result)
    {
      return false;
    }
  });

  return result;
};

/**
 * @return {boolean}
 */
Reservoirs.prototype.isMinWaterLevelReached = function()
{
  var result = false;

  lodash.each(this.reservoirs, function(reservoir)
  {
    result = reservoir.isActive() && reservoir.isMinWaterLevelReached();

    if (result)
    {
      return false;
    }
  });

  return result;
};

/**
 * @return {boolean}
 */
Reservoirs.prototype.getTotalWaterLevel = function()
{
  var result = 0;

  lodash.each(this.reservoirs, function(reservoir)
  {
    if (reservoir.isActive())
    {
      result += reservoir.getWaterLevel();
    }
  });

  return result;
};
