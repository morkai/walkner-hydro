// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var _ = require('lodash');
var axon = require('axon');

exports.DEFAULT_CONFIG = {
  pubHost: '0.0.0.0',
  pubPort: 5050,
  repHost: '0.0.0.0',
  repPort: 5051,
  pullHost: null,
  pullPort: 5052,
  broadcastTopics: []
};

exports.start = function startMessengerServerModule(app, module, done)
{
  var requestHandlers = {};
  var pubSocket = null;
  var repSocket = null;
  var pullSocket = null;

  _.forEach(module.config.broadcastTopics, function(broadcastTopic)
  {
    app.broker.subscribe(broadcastTopic, function(message, topic)
    {
      module.broadcast(topic, typeof message === 'undefined' ? null : message);
    });
  });

  createPullSocket();

  createPubSocket(function(err, socket)
  {
    if (err)
    {
      return done(err);
    }

    pubSocket = socket;

    module.debug("pub socket listening on port %d...", module.config.pubPort);

    createRepSocket(function(err, socket)
    {
      if (err)
      {
        return done(err);
      }

      repSocket = socket;

      module.debug("rep socket listening on port %d...", module.config.repPort);

      done();
    });
  });

  /**
   * @param {string} type
   * @param {function(object, function)} handler
   */
  module.handle = function(type, handler)
  {
    requestHandlers[type] = handler;
  };

  /**
   * @param {string} topic
   * @param {object} message
   */
  module.broadcast = function(topic, message)
  {
    if (pubSocket)
    {
      pubSocket.send(topic, message);
    }
  };

  /**
   * @private
   * @param {function(Error, object)} done
   */
  function createPubSocket(done)
  {
    var pub = axon.socket('pub');

    pub.set('hwm', 10);
    pub.bind(module.config.pubPort, module.config.pubHost);

    pub.once('error', done);

    pub.on('bind', function()
    {
      pub.removeListener('error', done);

      done(null, pub);
    });
  }

  /**
   * @private
   * @param {function(Error, object)} done
   */
  function createRepSocket(done)
  {
    var rep = axon.socket('rep');

    rep.set('hwm', 10);
    rep.bind(module.config.repPort, module.config.repHost);

    rep.once('error', done);

    rep.on('bind', function()
    {
      rep.removeListener('error', done);

      rep.on('message', handleRequest);

      done(null, rep);
    });
  }

  /**
   * @private
   */
  function createPullSocket()
  {
    if (!module.config.pullHost)
    {
      return module.debug("pull socket not used.");
    }

    var connected = false;

    pullSocket = axon.socket('rep');

    pullSocket.set('hwm', 10);
    pullSocket.connect(module.config.pullPort, module.config.pullHost);

    pullSocket.on('error', function(err)
    {
      module.error("[pull] %s", err.message);
    });

    pullSocket.on('connect', function()
    {
      connected = true;

      module.debug("[pull] Connected on port %d...", module.config.pullPort);

      app.broker.publish('messenger.client.connected', {
        moduleName: module.name,
        socketType: 'pull',
        host: module.config.pullHost,
        port: module.config.pullPort
      });
    });

    pullSocket.on('reconnect attempt', function()
    {
      if (connected)
      {
        module.debug("[pull] Disconnected. Reconnecting...");

        connected = false;
      }
    });

    pullSocket.on('message', handleRequest);
  }

  /**
   * @private
   * @param {string} type
   * @param {object} req
   * @param {function} reply
   */
  function handleRequest(type, req, reply)
  {
    if (!_.isString(type) || !_.isFunction(reply))
    {
      return;
    }

    var requestHandler = requestHandlers[type];

    if (!_.isFunction(requestHandler))
    {
      return;
    }

    requestHandler(_.isObject(req) ? req : {}, function(err)
    {
      if (err instanceof Error)
      {
        arguments[0] = {
          message: err.message,
          name: err.name,
          code: err.code
        };
      }

      reply.apply(null, arguments);
    });
  }
};
