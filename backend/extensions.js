// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

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

    Object.keys(error).forEach(function(property)
    {
      result[property] = error[property];
    });

    return result;
  }
});
