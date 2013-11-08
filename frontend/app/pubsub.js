define([
  'underscore',
  'h5.pubsub/MessageBroker',
  './broker',
  './socket'
],
/**
 * @param {underscore} _
 * @param {function(new:h5.pubsub.MessageBroker)} MessageBroker
 * @param {h5.pubsub.Broker} broker
 * @param {Socket} socket
 */
function(
  _,
  MessageBroker,
  broker,
  socket
) {
  'use strict';

  var pubsub = new MessageBroker();

  pubsub.on('new topic', function(topic)
  {
    var topics = [topic];

    if (socket.isConnected())
    {
      socket.emit(
        'pubsub.subscribe', topics, onSocketSubscribe.bind(null, topics)
      );
    }
  });

  pubsub.on('empty topic', function(topic)
  {
    socket.emit('pubsub.unsubscribe', [topic]);

    broker.publish('pubsub.unsubscribed', {topic: topic});
  });

  pubsub.on('message', function(topic, message, meta)
  {
    if (meta.remote === true)
    {
      return;
    }

    socket.emit('pubsub.publish', topic, message, meta, function(err)
    {
      if (err)
      {
        broker.publish('pubsub.publishFailed', {
          err: err,
          topic: topic,
          message: message,
          meta: meta
        });
      }
      else
      {
        broker.publish('pubsub.published', {
          topic: topic,
          message: message,
          meta: meta
        });
      }
    });
  });

  socket.on('connect', function()
  {
    var topics = Object.keys(pubsub.count());

    if (topics.length === 0)
    {
      return;
    }

    socket.emit(
      'pubsub.subscribe', topics, onSocketSubscribe.bind(null, topics)
    );
  });

  socket.on('pubsub.message', function(topic, message)
  {
    pubsub.publish(topic, message, {remote: true});
  });

  function onSocketSubscribe(topics, err, notAllowedTopics)
  {
    if (err)
    {
      broker.publish('pubsub.subscribeFailed', {
        err: err,
        topics: topics
      });

      return;
    }

    if (notAllowedTopics.length > 0)
    {
      broker.publish('pubsub.subscribeNotAllowed', {
        topics: notAllowedTopics
      });
    }

    var subscribedTopics = _.difference(topics, notAllowedTopics);

    if (subscribedTopics.length > 0)
    {
      broker.publish('pubsub.subscribed', {
        topics: subscribedTopics
      });
    }
  }

  return pubsub;
});
