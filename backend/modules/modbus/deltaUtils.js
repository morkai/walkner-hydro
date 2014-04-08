// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

/**
 * @type {object.<string, number>}
 */
var DELTA_FUNCTIONS = {
  S: 0x02,
  X: 0x02,
  Y: 0x01,
  M: 0x01,
  T: 0x03,
  C: 0x03,
  D: 0x03
};

/**
 * @type {object.<string, function(number): number>}
 */
var DELTA_ADDRESSES = {
  S: function(value)
  {
    return value < 0 || value > 1023 ? -1 : (0x0000 + value);
  },
  X: function(value)
  {
    if (value < 0 || value > 377)
    {
      return -1;
    }

    return 0x0400 + (Math.floor(value / 10) * 8) + (value % 10);
  },
  Y: function(value)
  {
    if (value < 0 || value > 377)
    {
      return -1;
    }

    return 0x0500 + (Math.floor(value / 10) * 8) + (value % 10);
  },
  T: function(value)
  {
    return value < 0 || value > 255 ? -1 : (0x0600 + value);
  },
  M: function(value)
  {
    if (value < 0 || value > 4095)
    {
      return -1;
    }

    if (value < 1536)
    {
      return 0x0800 + value;
    }

    return 0xB000 + value - 1536;
  },
  C: function(value)
  {
    return value < 0 || value > 255 ? -1 : (0x0E00 + value);
  },
  D: function(value)
  {
    if (value < 0 || value > 11999)
    {
      return -1;
    }

    if (value < 4096)
    {
      return 0x1000 + value;
    }

    return 0x9000 + value - 4096;
  }
};

/**
 * @param {string} deltaAddress
 * @returns {number}
 */
exports.getFunctionCode = function(deltaAddress)
{
  var device = deltaAddress.charAt(0);

  if (typeof DELTA_FUNCTIONS[device] !== 'number')
  {
    return -1;
  }

  return DELTA_FUNCTIONS[device];
};

/**
 * @param {string} deltaAddress
 * @returns {number}
 */
exports.getStartingAddress = function(deltaAddress)
{
  var device = deltaAddress.charAt(0);

  if (typeof DELTA_ADDRESSES[device] !== 'function')
  {
    return -1;
  }

  var offset = parseInt(deltaAddress.substr(1), 10);

  return DELTA_ADDRESSES[device](offset);
};
