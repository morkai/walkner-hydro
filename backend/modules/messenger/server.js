'use strict';

var lodash = require('lodash');
var axon = require('axon');

exports.DEFAULT_CONFIG = {
  pubHost: '0.0.0.0',
  pubPort: 5050,
  repHost: '0.0.0.0',
  repPort: 5051,
  broadcastTopics: []
};

exports.start = function startMessengerServerModule(app, module, done)
{
  var requestHandlers = {};
  var pubSocket = null;
  var repSocket = null;

  module.config.broadcastTopics.forEach(function(broadcastTopic)
  {
    app.broker.subscribe(broadcastTopic, function(message, topic)
    {
      module.broadcast(topic, typeof message === 'undefined' ? null : message);
    });
  });

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
    pub.format('json');
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
    rep.format('json');
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
   * @param {string} type
   * @param {object} req
   * @param {function} reply
   */
  function handleRequest(type, req, reply)
  {
    if (!lodash.isString(type) || !lodash.isFunction(reply))
    {
      return;
    }

    var requestHandler = requestHandlers[type];

    if (!lodash.isFunction(requestHandler))
    {
      return;
    }

    requestHandler(lodash.isObject(req) ? req : {}, function(err)
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
