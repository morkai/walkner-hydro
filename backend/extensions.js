// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var util = require('util');

Object.defineProperty(Error.prototype, 'toJSON', {
  configurable: false,
  enumerable: false,
  writable: true,
  value: function()
  {
    var error = this;
    var result = {
      message: error.message,
      stack: error.stack
    };
    var keys = Object.keys(error);

    for (var i = 0; i < keys.length; ++i)
    {
      var key = keys[i];

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
  var time = process.hrtime();
  var result = func.call(context);
  var diff = process.hrtime(time);

  console.log('[bench] %s %d ms', label, (diff[0] * 1e9 + diff[1]) / 1e6);

  return result;
};
