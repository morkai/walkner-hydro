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
