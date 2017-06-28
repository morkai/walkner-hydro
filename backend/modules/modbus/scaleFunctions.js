// Part of <https://miracle.systems/p/walkner-furmon> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');

/**
 * @private
 * @type {RegExp}
 */
const SCALE_FUNCTIONS_RE = /([a-zA-Z0-9]+)(?:\((.*?)\))?/g;

/**
 * @private
 * @type {{rawValueToValue: function, valueToRawValue: function}}
 */
const NOOP_SCALE_FUNCTIONS = {
  rawValueToValue: function(rawValue) { return rawValue; },
  valueToRawValue: function(value) { return value; }
};

/**
 * @type {Object<string, function>}
 */
var SCALE_FUNCTIONS = {

  round: function(tag, args)
  {
    const decimals = Math.pow(10, (typeof args[0] === 'number' ? args[0] : 0));

    return {
      rawValueToValue: round.bind(null, decimals),
      valueToRawValue: NOOP_SCALE_FUNCTIONS.valueToRawValue
    };
  },

  div: function(tag, args)
  {
    const divisor = typeof args[0] === 'number' ? args[0] : 1;

    return {
      rawValueToValue: div.bind(null, divisor),
      valueToRawValue: mul.bind(null, divisor)
    };
  },

  minMax: function(tag, args)
  {
    const rawMin = typeof args[0] === 'number' ? args[0] : tag.rawMin;
    const rawMax = typeof args[1] === 'number' ? args[1] : tag.rawMax;
    const scaleMin = typeof args[2] === 'number' ? args[2] : tag.scaleMin;
    const scaleMax = typeof args[3] === 'number' ? args[3] : tag.scaleMax;

    if (rawMax === null || scaleMax === null)
    {
      return NOOP_SCALE_FUNCTIONS;
    }

    return {
      rawValueToValue: scale.bind(null, rawMin, rawMax, scaleMin, scaleMax),
      valueToRawValue: scale.bind(null, scaleMin, scaleMax, rawMin, rawMax)
    };
  },

  flip: function()
  {
    return {
      rawValueToValue: flip,
      valueToRawValue: flip
    };
  },

  cast: function(tag, args)
  {
    const castType = typeof args[0] === 'string' ? args[0] : 'number';

    return {
      rawValueToValue: cast.bind(null, castType),
      valueToRawValue: cast.bind(null, tag.type)
    };
  },

  sub: function(subtrahendTag, args)
  {
    const minuendTags = [];

    _.forEach(args, function(tagName)
    {
      const minuendTag = subtrahendTag.modbus.tags[tagName];

      if (minuendTag)
      {
        minuendTags.push(minuendTag);
      }
    });

    if (minuendTags.length === 0)
    {
      return NOOP_SCALE_FUNCTIONS;
    }

    const doSub = sub.bind(null, minuendTags);

    return {
      rawValueToValue: doSub,
      valueToRawValue: doSub
    };
  },

  offset: function(tag, args)
  {
    const offsetValue = typeof args[0] === 'number' ? args[0] : 0;

    if (offsetValue === 0)
    {
      return NOOP_SCALE_FUNCTIONS;
    }

    return {
      rawValueToValue: offset.bind(null, offsetValue),
      valueToRawValue: offset.bind(null, -offsetValue)
    };
  },

  nil: function(tag, nullValues)
  {
    if (nullValues.length === 0)
    {
      return NOOP_SCALE_FUNCTIONS;
    }

    if (nullValues.length === 1)
    {
      const nullValue = nullValues[0];

      return {
        rawValueToValue: rawValue => rawValue === nullValue ? null : rawValue,
        valueToRawValue: value => value === null ? nullValue : value
      };
    }

    return {
      rawValueToValue: rawValue => nullValues.includes(rawValue) ? null : rawValue,
      valueToRawValue: value => value === null ? nullValues[0] : value
    }
  },

  const: function(tag, args)
  {
    if (args.length === 0)
    {
      return NOOP_SCALE_FUNCTIONS;
    }

    const constValue = args[0];

    return {
      rawValueToValue: () => constValue,
      valueToRawValue: () => constValue
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
  return (scaleMax - scaleMin) * (value - rawMin) / (rawMax - rawMin) + scaleMin;
}

function flip(value)
{
  return !value;
}

function cast(type, value)
{
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
      return !!value;
  }

  return value;
}

function sub(minuendTags, value)
{
  return minuendTags.reduce((sum, tag) => sum + tag.getValue(), 0) - value;
}

function offset(offsetValue, value)
{
  return value + offsetValue;
}

/**
 * @private
 * @param {Tag} tag
 * @param {string} scaleFunctions
 * @returns {Array<Object<string, Object>>}
 */
function parseScaleFunctions(tag, scaleFunctions)
{
  var result = [];
  var matches;

  while ((matches = SCALE_FUNCTIONS_RE.exec(scaleFunctions)) !== null) // eslint-disable-line no-cond-assign
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
  argValue = argValue.trim();

  const numValue = parseFloat(argValue);

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

  const scaleFunctions = parseScaleFunctions(tag, tag.scaleFunction);
  const scaleFunctionsCount = scaleFunctions.length;

  if (scaleFunctionsCount === 0)
  {
    return NOOP_SCALE_FUNCTIONS;
  }

  return {
    rawValueToValue: function(rawValue)
    {
      var value = rawValue;

      for (let i = 0; i < scaleFunctionsCount; ++i)
      {
        value = scaleFunctions[i].rawValueToValue(value);

        if (value === null)
        {
          return null;
        }
      }

      return value;
    },
    valueToRawValue: function(value)
    {
      var rawValue = value;

      for (let i = scaleFunctionsCount - 1; i >= 0; --i)
      {
        rawValue = scaleFunctions[i].valueToRawValue(rawValue);
      }

      return rawValue;
    }
  };
};
