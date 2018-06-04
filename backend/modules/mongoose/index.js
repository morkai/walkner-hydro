// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const mongoose = require('mongoose');
const expressMiddleware = require('./expressMiddleware');

exports.DEFAULT_CONFIG = {
  maxConnectTries: 10,
  connectAttemptDelay: 500,
  uri: 'mongodb://localhost/test',
  mongoClient: {},
  models: null,
  keepAliveQueryInterval: 30000,
  stopOnConnectError: true
};

exports.start = function startDbModule(app, module, done)
{
  let keepAliveFailed = false;
  let initialized = false;

  module = app[module.name] = _.assign(mongoose, module);

  module.Promise = global.Promise;

  module.connection.on('connecting', () => module.debug('Connecting...'));
  module.connection.on('connected', () => module.debug('Connected.'));
  module.connection.on('open', () => module.debug('Open.'));
  module.connection.on('reconnected', () => module.debug('Reconnected.'));
  module.connection.on('disconnecting', () => module.warn('Disconnecting...'));
  module.connection.on('disconnected', () => module.warn('Disconnected.'));
  module.connection.on('close', () => module.warn('Closed.'));
  module.connection.on('unauthorized', () => module.warn('Unauthorized.'));
  module.connection.on('error', (err) => module.error(err.stack));

  app.broker.subscribe('express.beforeMiddleware', setUpExpressMiddleware).setLimit(1);

  tryToConnect(0);

  /**
   * @private
   * @param {number} i
   */
  function tryToConnect(i)
  {
    if (module.connection.readyState === mongoose.Connection.STATES.connected
      || module.connection.readyState === mongoose.Connection.STATES.connecting)
    {
      return;
    }

    module.connect(module.config.uri, module.config.mongoClient)
      .then(() => initialize())
      .catch(err =>
      {
        if (i >= module.config.maxConnectTries)
        {
          return initialize(err);
        }

        return setTimeout(tryToConnect.bind(null, i + 1), module.config.connectAttemptDelay);
      });
  }

  function initialize(err)
  {
    if (err)
    {
      if (module.config.stopOnConnectError)
      {
        return done(err);
      }

      module.error(err.message);

      setTimeout(tryToConnect, 10000, 0);
    }

    if (!initialized)
    {
      initialized = true;

      setUpKeepAliveQuery();
      loadModels();
    }
  }

  /**
   * @private
   */
  function loadModels()
  {
    const modelsDir = app.pathTo('models');
    const modelsList = module.config.models || require(app.pathTo('models', 'index'));

    app.loadFiles(modelsDir, modelsList, [app, module], done);
  }

  function setUpKeepAliveQuery()
  {
    if (!module.config.keepAliveQueryInterval)
    {
      return;
    }

    module.connection.db.stats(function(err, stats)
    {
      if (err)
      {
        if (!keepAliveFailed)
        {
          module.error(`Keep alive query failed: ${err.message}`);
        }

        keepAliveFailed = true;
      }
      else
      {
        if (keepAliveFailed)
        {
          module.debug(`Kept alive: ${JSON.stringify(stats)}`);
        }

        keepAliveFailed = false;
      }

      setTimeout(setUpKeepAliveQuery, module.config.keepAliveQueryInterval);
    });
  }

  function setUpExpressMiddleware(message)
  {
    const expressModule = message.module;
    const expressApp = expressModule.app;

    expressApp.use(expressMiddleware.bind(null, app, module));
  }
};
