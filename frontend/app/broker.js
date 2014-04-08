// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
