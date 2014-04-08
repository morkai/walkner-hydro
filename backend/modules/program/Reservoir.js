// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var util = require('util');
var ControlUnit = require('./ControlUnit');

module.exports = Reservoir;

/**
 * @constructor
 * @extends {ControlUnit}
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 * @param {number} index
 */
function Reservoir(broker, modbus, program, index)
{
  ControlUnit.call(this, broker, modbus, program, 'reservoirs', index);

  this.watch(
    ['.height', '.waterLevel', '.waterLevel.min', '.waterLevel.max'],
    'checkReservoirExtremes'
  );
}

util.inherits(Reservoir, ControlUnit);

/**
 * @returns {boolean}
 */
Reservoir.prototype.isActive = function()
{
  return !!this.getTagValue('.state');
};

/**
 * @returns {number}
 */
Reservoir.prototype.getHeight = function()
{
  return this.getTagValue('.height');
};

/**
 * @returns {number|null}
 */
Reservoir.prototype.getWaterLevel = function()
{
  return this.getTagValue('.waterLevel');
};

/**
 * @returns {number|null}
 */
Reservoir.prototype.getMaxWaterLevel = function()
{
  return this.getTagValue('.waterLevel.max');
};

/**
 * @returns {number|null}
 */
Reservoir.prototype.getMinWaterLevel = function()
{
  return this.getTagValue('.waterLevel.min');
};

/**
 * @returns {boolean}
 */
Reservoir.prototype.isMaxWaterLevelReached = function()
{
  return this.getWaterLevel() > this.getMaxWaterLevel();
};

/**
 * @returns {boolean}
 */
Reservoir.prototype.isMinWaterLevelReached = function()
{
  return this.getWaterLevel() < this.getMinWaterLevel();
};

/**
 * @private
 */
Reservoir.prototype.checkReservoirExtremes = function()
{
  if (!this.isActive())
  {
    return;
  }

  if (this.isMinWaterLevelReached())
  {
    this.broker.publish('program.reservoirs.minWaterLevelReached', {
      reservoir: this
    });
  }
  else if (this.isMaxWaterLevelReached())
  {
    this.broker.publish('program.reservoirs.maxWaterLevelReached', {
      reservoir: this
    });
  }
};
