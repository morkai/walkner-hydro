// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const path = require('path');

module.exports = function monkeyPatch(app, module, options)
{
  if (options.View)
  {
    const originalLookup = options.View.prototype.lookup;

    options.View.prototype.lookup = function(name)
    {
      const colonIndex = name.indexOf(':');

      if (colonIndex === -1)
      {
        return originalLookup.call(this, name);
      }

      const moduleName = name.substring(0, colonIndex);
      const file = name.substring(colonIndex + 1);
      const loc = app.pathTo('modules', moduleName, 'templates', file);

      return this.resolve(path.dirname(loc), path.basename(loc));
    };
  }
};
