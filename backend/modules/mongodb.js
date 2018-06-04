// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const mongodb = require('mongodb');

exports.DEFAULT_CONFIG = {
  uri: 'mongodb://127.0.0.1:27017/test',
  mongoClient: {},
  keepAliveQueryInterval: 30000
};

exports.start = function startMongodbModule(app, module, done)
{
  let keepAliveFailed = false;

  mongodb.MongoClient.connect(module.config.uri, module.config.mongoClient, onComplete);

  function onComplete(err, client)
  {
    if (err)
    {
      return done(err);
    }

    module.client = client;
    module.db = client.db();

    setUpEventListeners();
    setUpKeepAliveQuery();

    module.debug('Open.');

    done();
  }

  function setUpEventListeners()
  {
    module.client.on('error', (err) => module.error(err.stack));
    module.client.on('parseError', (err) => module.error(err.stack));
    module.client.on('timeout', () => module.warn('Timeout.'));
    module.client.on('close', () => module.warn('Closed.'));
    module.client.on('reconnect', () => module.debug('Reconnected.'));
    module.client.on('authenticated', () => module.debug('Authenticated.'));
  }

  function setUpKeepAliveQuery()
  {
    if (!module.config.keepAliveQueryInterval)
    {
      return;
    }

    module.db.stats(function(err, stats)
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
};
