// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var lodash = require('lodash');

module.exports = function startProgramSimulator(app, modbus)
{
  lodash.each(modbus.tags, function toggleStatusOnControlChange(tag)
  {
    if (tag.name.indexOf('.control') === -1)
    {
      return;
    }

    var statusTag = modbus.tags[tag.name.replace('.control', '.status')];

    if (!lodash.isObject(statusTag))
    {
      return;
    }

    app.broker.subscribe('tagValueChanged.' + tag.name, function(message)
    {
      statusTag.writeValue(message.newValue, function() {});
    });
  });
};
