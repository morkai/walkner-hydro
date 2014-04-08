// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

/*jshint maxparams:6*/

'use strict';

/**
 * @private
 * @type {RegExp}
 */
var SCALE_FUNCTIONS_RE = /([a-zA-Z0-9]+)(?:\((.*?)\))?/g;

/**
 * @private
 * @type {{rawValueToValue: Function, valueToRawValue: Function}}
 */
var NOOP_SCALE_FUNCTIONS = {
  rawValueToValue: function(rawValue) { return rawValue; },
  valueToRawValue: function(value) { return value; }
};

/**
 * @type {object.<string, function>}
 */
var SCALE_FUNCTIONS = {

  'round': function(tag, args)
  {
    var decimals = Math.pow(10, (typeof args[0] === 'number' ? args[0] : 0));

    return {
      rawValueToValue: round.bind(null, decimals),
      valueToRawValue: NOOP_SCALE_FUNCTIONS.valueToRawValue
    };
  },

  'div': function(tag, args)
  {
    var divisor = typeof args[0] === 'number' ? args[0] : 1;

    return {
      rawValueToValue: div.bind(null, divisor),
      valueToRawValue: mul.bind(null, divisor)
    };
  },

  'minMax': function(tag, args)
  {
    var rawMin = typeof args[0] === 'number' ? args[0] : tag.rawMin;
    var rawMax = typeof args[1] === 'number' ? args[1] : tag.rawMax;
    var scaleMin = typeof args[2] === 'number' ? args[2] : tag.scaleMin;
    var scaleMax = typeof args[3] === 'number' ? args[3] : tag.scaleMax;

    if (rawMax === null || scaleMax === null)
    {
      return NOOP_SCALE_FUNCTIONS;
    }

    return {
      rawValueToValue: scale.bind(null, rawMin, rawMax, scaleMin, scaleMax),
      valueToRawValue: scale.bind(null, scaleMin, scaleMax, rawMin, rawMax)
    };
  },

  'flip': function()
  {
    return {
      rawValueToValue: flip,
      valueToRawValue: flip
    };
  },

  'cast': function(tag, args)
  {
    var castType = typeof args[0] === 'string' ? args[0] : 'number';

    return {
      rawValueToValue: cast.bind(null, castType),
      valueToRawValue: cast.bind(null, tag.type)
    };
  },

  'sub': function(subtrahendTag, args)
  {
    var minuendTags = [];

    args.forEach(function(tagName)
    {
      var minuendTag = subtrahendTag.modbus.tags[tagName];

      if (typeof minuendTag !== 'undefined')
      {
        minuendTags.push(minuendTag);
      }
    });

    if (minuendTags.length === 0)
    {
      return NOOP_SCALE_FUNCTIONS;
    }

    var doSub = sub.bind(null, minuendTags);

    return {
      rawValueToValue: doSub,
      valueToRawValue: doSub
    };
  },

  'offset': function(tag, args)
  {
    var offsetValue = typeof args[0] === 'number' ? args[0] : 0;

    if (offsetValue === 0)
    {
      return NOOP_SCALE_FUNCTIONS;
    }

    return {
      rawValueToValue: offset.bind(null, offsetValue),
      valueToRawValue: offset.bind(null, -offsetValue)
    };
  }

};

function round(decimals, rawValue)
{
  return Math.round(rawValue * decimals) / decimals;
}

function div(divisor, rawValue)
{
  return rawValue / divisor;
}

function mul(multiplier, value)
{
  return value * multiplier;
}

function scale(rawMin, rawMax, scaleMin, scaleMax, value)
{
  return (scaleMax - scaleMin) * (value - rawMin) / (rawMax - rawMin)
    + scaleMin;
}

function flip(value)
{
  return !value;
}

function cast(type, value)
{
  /*jshint -W015*/

  switch (type)
  {
    case 'number':
      switch (typeof value)
      {
        case 'bool':
          return value ? 1 : 0;
      }
      break;

    case 'bool':
      return value ? true : false;
  }

  return value;
}

function sub(minuendTags, value)
{
  var minuend = minuendTags.reduce(function(sum, tag)
  {
    return sum + tag.getValue();
  }, 0);

  return minuend - value;
}

function offset(offsetValue, value)
{
  return value + offsetValue;
}

/**
 * @private
 * @param {Tag} tag
 * @param {string} scaleFunctions
 * @returns {Array.<object.<string, object>>}
 */
function parseScaleFunctions(tag, scaleFunctions)
{
  var result = [];
  var matches;

  while ((matches = SCALE_FUNCTIONS_RE.exec(scaleFunctions)) !== null)
  {
    var name = matches[1];
    var args = typeof matches[2] !== 'string' || matches[2].length === 0
      ? []
      : matches[2].split(',').map(parseArgValue);

    if (typeof SCALE_FUNCTIONS[name] === 'function')
    {
      result.push(SCALE_FUNCTIONS[name](tag, args));
    }
  }

  return result;
}

/**
 * @private
 * @param {string} argValue
 * @returns {*}
 */
function parseArgValue(argValue)
{
  /*jshint -W015*/

  argValue = argValue.trim();

  var numValue = parseFloat(argValue);

  if (!isNaN(numValue))
  {
    return numValue;
  }

  switch (argValue.toLowerCase())
  {
    case 'true':
      return true;

    case 'false':
      return false;

    case 'null':
      return null;

    default:
      return argValue;
  }
}

/**
 * @param {Tag} tag
 * @returns {{rawValueToValue: function, valueToRawValue: function}}
 */
exports.create = function(tag)
{
  if (typeof tag.scaleFunction !== 'string')
  {
    return NOOP_SCALE_FUNCTIONS;
  }

  var scaleFunctions = parseScaleFunctions(tag, tag.scaleFunction);
  var scaleFunctionsCount = scaleFunctions.length;

  if (scaleFunctionsCount === 0)
  {
    return NOOP_SCALE_FUNCTIONS;
  }

  return {
    rawValueToValue: function(rawValue)
    {
      var value = rawValue;

      for (var i = 0; i < scaleFunctionsCount; ++i)
      {
        value = scaleFunctions[i].rawValueToValue(value);
      }

      return value;
    },
    valueToRawValue: function(value)
    {
      var rawValue = value;

      for (var i = scaleFunctionsCount - 1; i >= 0; --i)
      {
        rawValue = scaleFunctions[i].valueToRawValue(rawValue);
      }

      return rawValue;
    }
  };
};
