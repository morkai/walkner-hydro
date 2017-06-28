// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var _ = require('lodash');
var pubsub = require('h5.pubsub');

exports.DEFAULT_CONFIG = {
  sioId: 'sio',
  statsPublishInterval: 1000,
  republishMaxDelay: 3,
  republishTopics: []
};

exports.start = function startPubsubModule(app, module)
{
  var stats = {
    publishedMessages: 0,
    receivedMessages: 0,
    sentMessages: 0,
    ignoredEchoes: 0,
    ignoredDuplications: 0,
    totalSubscriptions: 0,
    currentSubscriptions: 0,
    unsubscriptions: 0
  };

  /**
   * @type {number}
   */
  var nextMessageId = 0;

  /**
   * @type {object.<string, Array>}
   */
  var idToMessageMap = {};

  /**
   * @type {object.<string, object.<string, boolean>>}
   */
  var socketIdToMessagesMap = {};

  /**
   * @type {RegExp}
   */
  var invalidTopicRegExp = /^(\s*|\s*\.\s*)+$/;

  /**
   * @type {function()}
   */
  var scheduleSendMessages = _.debounce(sendMessages, module.config.republishMaxDelay, {
    trailing: true,
    leading: false
  });

  /**
   * @type {MessageBroker}
   */
  module = app[module.name] = _.assign(new pubsub.MessageBroker(), module);

  _.forEach(module.config.republishTopics, function(topic)
  {
    app.broker.subscribe(topic, function(message, topic)
    {
      module.publish(topic, message);
    });
  });

  module.on('message', function(topic, message, meta)
  {
    if (stats.currentSubscriptions === 0)
    {
      return;
    }

    ++stats.publishedMessages;

    if (typeof meta.messageId === 'undefined')
    {
      meta.messageId = getNextMessageId();
    }

    if (typeof meta.json === 'undefined')
    {
      meta.json = false;
    }

    idToMessageMap[meta.messageId] = [topic, message, meta];

    scheduleSendMessages();
  });

  module.on('subscribe', function()
  {
    ++stats.totalSubscriptions;
    ++stats.currentSubscriptions;
  });

  module.on('cancel', function()
  {
    --stats.currentSubscriptions;
    ++stats.unsubscriptions;
  });

  app.onModuleReady(module.config.sioId, function()
  {
    app[module.config.sioId].sockets.on('connection', function onSocketConnect(socket)
    {
      socket.pubsub = module.sandbox();
      socket.pubsub.onSubscriptionMessage = onSubscriptionMessage.bind(null, socket);

      socket.on('disconnect', onSocketDisconnect);
      socket.on('pubsub.subscribe', onSocketSubscribe);
      socket.on('pubsub.unsubscribe', onSocketUnsubscribe);
      socket.on('pubsub.publish', onSocketPublish);
    });
  });

  publishPubsubStats();

  function publishPubsubStats()
  {
    var interval = module.config.statsPublishInterval;

    if (interval <= 0)
    {
      return;
    }

    module.publish('stats.pubsub', stats);

    setTimeout(publishPubsubStats, interval);
  }

  function onSocketDisconnect()
  {
    /*jshint validthis:true*/

    var socket = this;

    delete socketIdToMessagesMap[socket.id];

    socket.pubsub.destroy();
    socket.pubsub.onSubscriptionMessage = null;
    socket.pubsub = null;
  }

  /**
   * @param {Array.<string>} topics
   * @param {function} [cb]
   */
  function onSocketSubscribe(topics, cb)
  {
    /*jshint validthis:true*/

    var hasCb = typeof cb === 'function';

    if (!Array.isArray(topics))
    {
      if (hasCb)
      {
        cb("First argument must be an array of topics.");
      }

      return;
    }

    var socket = this;
    var pubsub = socket.pubsub;
    var notAllowedTopics = [];

    for (var i = 0, l = topics.length; i < l; ++i)
    {
      var topic = topics[i];

      if (isValidTopic(topic) && isSocketAllowedToSubscribe(socket, topic))
      {
        pubsub.subscribe(topic, pubsub.onSubscriptionMessage);
      }
      else
      {
        notAllowedTopics.push(topic);
      }
    }

    if (hasCb)
    {
      cb(null, notAllowedTopics);
    }
  }

  /**
   * @param {Array.<string>} topics
   */
  function onSocketUnsubscribe(topics)
  {
    /*jshint validthis:true*/

    if (!Array.isArray(topics))
    {
      return;
    }

    var socket = this;
    var pubsub = socket.pubsub;

    for (var i = 0, l = topics.length; i < l; ++i)
    {
      var topic = topics[i];

      if (isValidTopic(topic))
      {
        pubsub.unsubscribe(topic);
      }
    }
  }

  /**
   * @param {string} topic
   * @param {*} message
   * @param {object} meta
   * @param {function} [cb]
   */
  function onSocketPublish(topic, message, meta, cb)
  {
    /*jshint validthis:true*/

    var socket = this;

    ++stats.receivedMessages;

    meta.socketId = socket.id;

    socket.pubsub.publish(topic, message, meta);

    if (typeof cb === 'function')
    {
      cb();
    }
  }

  /**
   * @param {Socket} socket
   * @param {*} message
   * @param {string} topic
   * @param {object} meta
   */
  function onSubscriptionMessage(socket, message, topic, meta)
  {
    if (meta.socketId === socket.id)
    {
      ++stats.ignoredEchoes;

      return;
    }

    var socketMessagesMap = socketIdToMessagesMap[socket.id];

    if (!socketMessagesMap)
    {
      socketMessagesMap = socketIdToMessagesMap[socket.id] = {};
    }

    if (socketMessagesMap[meta.messageId])
    {
      ++stats.ignoredDuplications;

      return;
    }

    socketMessagesMap[meta.messageId] = true;
  }

  function sendMessages()
  {
    /*jshint forin:false*/

    var sockets =  app[module.config.sioId].sockets.connected;
    var socketIds = Object.keys(socketIdToMessagesMap);

    for (var i = 0, l = socketIds.length; i < l; ++i)
    {
      var socketId = socketIds[i];
      var socket = sockets[socketId];

      if (socket === undefined)
      {
        continue;
      }

      var socketMessagesMap = socketIdToMessagesMap[socketId];
      var messageIds = Object.keys(socketMessagesMap);

      for (var j = 0, m = messageIds.length; j < m; ++j)
      {
        var message = idToMessageMap[messageIds[j]];
        var topic = message[0];
        var payload = message[1];
        var meta = message[2];

        if (!meta.json)
        {
          meta.payload = JSON.stringify(meta.payload);
          meta.json = true;
        }

        socket.emit('pubsub.message', topic, payload, meta);

        ++stats.sentMessages;
      }
    }

    socketIdToMessagesMap = {};
    idToMessageMap = {};
  }

  /**
   * @param {string} topic
   * @returns {boolean}
   */
  function isValidTopic(topic)
  {
    return typeof topic === 'string'
      && topic.length > 0
      && invalidTopicRegExp.test(topic) === false;
  }

  /**
   * @param {Socket} socket
   * @param {string} topic
   * @returns {boolean}
   */
  function isSocketAllowedToSubscribe(socket, topic)
  {
    /*jshint unused:false*/

    return true;
  }

  /**
   * @returns {string}
   */
  function getNextMessageId()
  {
    ++nextMessageId;

    if (nextMessageId === 0xFFFFFFFF)
    {
      nextMessageId = 1;
    }

    return nextMessageId.toString(36);
  }
};
