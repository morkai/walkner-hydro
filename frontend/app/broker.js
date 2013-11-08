define([
  'h5.pubsub/MessageBroker'
],
/**
 * @param {function(new:h5.pubsub.MessageBroker)} MessageBroker
 */
function(
  MessageBroker
) {
  'use strict';

  var broker = new MessageBroker();

  broker.on('message', function(topic, message)
  {
    if (topic === 'controller.tagValuesChanged')
    {
      return;
    }

    if (typeof message === 'undefined')
    {
      console.log('[%s]', topic);
    }
    else
    {
      console.log('[%s]', topic, message);
    }
  });

  return broker;
});
