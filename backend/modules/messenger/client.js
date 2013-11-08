'use strict';

var lodash = require('lodash');
var axon = require('axon');

exports.DEFAULT_CONFIG = {
  pubHost: '127.0.0.1',
  pubPort: 5050,
  repHost: '127.0.0.1',
  repPort: 5051,
  responseTimeout: 5000
};

exports.start = function startControllerModule(app, module)
{
  var subSocket;
  var reqSocket;

  createSubSocket();
  createReqSocket();

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
    if (lodash.isFunction(responseHandler))
    {
      responseHandler = lodash.once(responseHandler);
    }
    else
    {
      responseHandler = function() {};
    }

    var timer = null;
    var reply = null;

    reply = lodash.once(function(err)
    {
      if (timer !== null)
      {
        clearTimeout(timer);
      }

      if (lodash.isString(err))
      {
        arguments[0] = {message: err};
      }

      responseHandler.apply(null, arguments);
    });

    reqSocket.send(type, data, reply);

    timer = app.timeout(module.config.responseTimeout, function()
    {
      timer = null;

      reply({code: 'RESPONSE_TIMEOUT', message: "Response timeout."});
    });
  };

  /**
   * @private
   */
  function createSubSocket()
  {
    var connected = false;

    subSocket = axon.socket('sub');

    subSocket.set('hwm', 10);
    subSocket.format('json');
    subSocket.connect(module.config.pubPort, module.config.pubHost);

    subSocket.on('error', function(err)
    {
      module.error("[sub] %s", err.message);
    });

    subSocket.on('connect', function()
    {
      connected = true;

      module.debug("[sub] Connected on port %d...", module.config.pubPort);

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
        module.debug("[sub] Disconnected. Reconnecting...");

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
    var connected = false;

    reqSocket = axon.socket('req');

    reqSocket.set('hwm', 10);
    reqSocket.format('json');
    reqSocket.connect(module.config.repPort, module.config.repHost);

    reqSocket.on('error', function(err)
    {
      module.error("[req] %s", err.message);
    });

    reqSocket.on('connect', function()
    {
      connected = true;

      module.debug("[req] Connected on port %d...", module.config.repPort);

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
        module.debug("[req] Disconnected. Reconnecting...");

        connected = false;
      }
    });
  }

  /**
   * @private
   * @param {string} topic
   * @param {object} message
   */
  function handleBroadcastMessage(topic, message)
  {
    app.broker.publish(topic, message);
  }
};
