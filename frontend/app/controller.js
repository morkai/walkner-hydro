define([
  './broker',
  './pubsub',
  './socket'
], function(
  broker,
  pubsub,
  socket
) {
  'use strict';

  var controller = {
    values: typeof window === 'object' && window.TAG_VALUES
      ? window.TAG_VALUES : {}
  };

  controller.getValue = function(tagName)
  {
    return controller.values[tagName];
  };

  controller.setValue = function(tagName, value, done)
  {
    socket.emit('controller.setTagValue', tagName, value, done);
  };

  pubsub.subscribe('controller.tagValuesChanged', function(changes)
  {
    var diff = {};
    var diffCount = 0;

    Object.keys(changes).forEach(function(tagName)
    {
      var oldValue = controller.values[tagName];
      var newValue = changes[tagName];

      if (newValue !== oldValue)
      {
        controller.values[tagName] = newValue;
        diff[tagName] = newValue;
        diffCount += 1;
      }
    });

    if (diffCount > 0)
    {
      broker.publish('controller.tagValuesChanged', diff);
    }
  });

  return controller;
});
