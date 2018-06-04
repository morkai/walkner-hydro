// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const axon = require('axon');

exports.DEFAULT_CONFIG = {
  pubHost: '127.0.0.1',
  pubPort: 5050,
  repHost: '127.0.0.1',
  repPort: 5051,
  pushHost: null,
  pushPort: 5052,
  responseTimeout: 5000,
  broadcastTopics: []
};

exports.start = function startMessengerClientModule(app, module, done)
{
  let subSocket;
  let reqSocket;
  let pushSocket = null;

  _.forEach(module.config.broadcastTopics, function(broadcastTopic)
  {
    app.broker.subscribe(broadcastTopic, function(message, topic, meta)
    {
      module.request('@broadcast', {
        topic: topic,
        message: message,
        meta: meta
      });
    });
  });

  createSubSocket();
  createReqSocket();
  createPushSocket(function(err, socket)
  {
    if (err)
    {
      return setImmediate(done, err);
    }

    pushSocket = socket;

    if (pushSocket === null)
    {
      module.debug('push socket not used.');
    }
    else
    {
      module.debug('push socket listening on port %d...', module.config.pushPort);
    }

    setImmediate(done);
  });

  /**
   * @returns {boolean}
   */
  module.isConnected = function()
  {
    return subSocket && subSocket.connected && reqSocket && reqSocket.connected;
  };

  /**
   * @param {string} type
   * @param {*} [data]
   * @param {function} [responseHandler]
   */
  module.request = function(type, data, responseHandler)
  {
    sendMessage(reqSocket, type, data, responseHandler);
  };

  /**
   * @param {string} type
   * @param {*} [data]
   * @param {function} [responseHandler]
   * @returns {undefined}
   */
  module.push = function(type, data, responseHandler)
  {
    if (pushSocket === null)
    {
      return responseHandler(new Error('NO_PUSH_SOCKET'));
    }

    sendMessage(pushSocket, type, data, responseHandler);
  };

  /**
   * @private
   */
  function createSubSocket()
  {
    let connected = false;

    subSocket = axon.socket('sub');

    subSocket.set('hwm', 10);
    subSocket.connect(module.config.pubPort, module.config.pubHost);

    subSocket.on('error', function(err)
    {
      module.error('[sub] %s', err.message);
    });

    subSocket.on('connect', function()
    {
      connected = true;

      module.debug('[sub] Connected on port %d...', module.config.pubPort);

      app.broker.publish('messenger.client.connected', {
        moduleName: module.name,
        socketType: 'sub',
        host: module.config.pubHost,
        port: module.config.pubPort
      });
    });

    subSocket.on('reconnect attempt', function()
    {
      if (connected)
      {
        module.debug('[sub] Disconnected. Reconnecting...');

        connected = false;
      }
    });

    subSocket.on('message', handleBroadcastMessage);
  }

  /**
   * @private
   */
  function createReqSocket()
  {
    let connected = false;

    reqSocket = axon.socket('req');

    reqSocket.set('hwm', 10);
    reqSocket.connect(module.config.repPort, module.config.repHost);

    reqSocket.on('error', function(err)
    {
      module.error('[req] %s', err.message);
    });

    reqSocket.on('connect', function()
    {
      connected = true;

      module.debug('[req] Connected on port %d...', module.config.repPort);

      app.broker.publish('messenger.client.connected', {
        moduleName: module.name,
        socketType: 'req',
        host: module.config.repHost,
        port: module.config.repPort
      });
    });

    reqSocket.on('reconnect attempt', function()
    {
      if (connected)
      {
        module.debug('[req] Disconnected. Reconnecting...');

        connected = false;

        app.broker.publish('messenger.client.disconnected', {
          moduleName: module.name,
          socketType: 'req',
          host: module.config.repHost,
          port: module.config.repPort
        });
      }
    });
  }

  /**
   * @private
   * @param {function(Error, Object)} done
   * @returns {undefined}
   */
  function createPushSocket(done)
  {
    if (!module.config.pushHost)
    {
      return done(null, null);
    }

    const push = axon.socket('req');

    push.set('hwm', 10);
    push.bind(module.config.pushPort, module.config.pushHost);

    push.once('error', done);

    push.on('bind', function()
    {
      push.removeListener('error', done);

      done(null, push);
    });
  }

  /**
   * @private
   * @param {Object} socket
   * @param {string} type
   * @param {*} [data]
   * @param {function} [responseHandler]
   * @returns {undefined}
   */
  function sendMessage(socket, type, data, responseHandler)
  {
    if (_.isFunction(responseHandler))
    {
      responseHandler = _.once(responseHandler);
    }
    else
    {
      responseHandler = function() {};
    }

    let timer = null;
    let reply = null;

    reply = _.once(function(err)
    {
      if (timer !== null)
      {
        clearTimeout(timer);
      }

      if (_.isString(err))
      {
        arguments[0] = {message: err};
      }

      responseHandler.apply(null, arguments);
    });

    if ((socket.type === 'client' && !socket.connected) || (socket.type === 'server' && socket.socks.length === 0))
    {
      return reply({
        code: 'NO_CONNECTION',
        message: socket.type === 'client' ? 'Not connected to the server.' : 'No clients connected.'
      });
    }

    socket.send(type, data, reply);

    timer = app.timeout(data && data.responseTimeout || module.config.responseTimeout, function()
    {
      timer = null;

      reply({code: 'RESPONSE_TIMEOUT', message: 'Response timeout.'});
    });
  }

  /**
   * @private
   * @param {string} topic
   * @param {Object} message
   * @returns {undefined}
   */
  function handleBroadcastMessage(topic, message)
  {
    app.broker.publish(topic, message);
  }
};
