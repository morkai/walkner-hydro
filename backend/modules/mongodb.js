// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var mongodb = require('mongodb');

exports.DEFAULT_CONFIG = {
  uri: 'mongodb://127.0.0.1:27017/test',
  server: {},
  db: {},
  keepAliveQueryInterval: 30000
};

exports.start = function startMongodbModule(app, module, done)
{
  let keepAliveFailed = false;

  mongodb.MongoClient.connect(module.config.uri, module.config, onComplete);

  function onComplete(err, db)
  {
    if (err)
    {
      return done(err);
    }

    module.db = db;

    setUpEventListeners();
    setUpKeepAliveQuery();

    module.debug('Open.');

    done();
  }

  function setUpEventListeners()
  {
    module.db.on('error', (err) => module.error(err.stack));
    module.db.on('parseError', (err) => module.error(err.stack));
    module.db.on('timeout', () => module.warn('Timeout.'));
    module.db.on('close', () => module.warn('Closed.'));
    module.db.on('reconnect', () => module.debug('Reconnected.'));
    module.db.on('authenticated', () => module.debug('Authenticated.'));
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
