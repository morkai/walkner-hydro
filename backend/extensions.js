// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

/* eslint-disable no-extend-native */

'use strict';

const util = require('util');

Object.defineProperty(Error.prototype, 'toJSON', {
  configurable: false,
  enumerable: false,
  writable: true,
  value: function()
  {
    const error = this;
    const result = {
      message: error.message,
      stack: error.stack
    };
    const keys = Object.keys(error);

    for (let i = 0; i < keys.length; ++i)
    {
      const key = keys[i];

      result[key] = error[key];
    }

    return result;
  }
});

console.inspect = function(value, depth, colors)
{
  console.log(util.inspect(value, {depth: depth || null, colors: colors !== false}));
};

console.bench = function(label, context, func)
{
  const time = process.hrtime();
  const result = func.call(context);
  const diff = process.hrtime(time);

  console.log('[bench] %s %d ms', label, (diff[0] * 1e9 + diff[1]) / 1e6);

  return result;
};
