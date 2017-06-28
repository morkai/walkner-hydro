// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var path = require('path');

module.exports = function monkeyPatch(app, module, options)
{
  if (options.View)
  {
    var originalLookup = options.View.prototype.lookup;

    options.View.prototype.lookup = function(name)
    {
      var colonIndex = name.indexOf(':');

      if (colonIndex === -1)
      {
        return originalLookup.call(this, name);
      }

      var moduleName = name.substring(0, colonIndex);
      var file = name.substring(colonIndex + 1);
      var loc = app.pathTo('modules', moduleName, 'templates', file);

      return this.resolve(path.dirname(loc), path.basename(loc));
    };
  }
};
