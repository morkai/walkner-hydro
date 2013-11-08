'use strict';

var mongodb = require('mongodb');

exports.DEFAULT_CONFIG = {
  uri: 'mongodb://127.0.0.1:27017/walkner-hydro',
  server: {},
  db: {}
};

exports.start = function startMongodbModule(app, module, done)
{
  mongodb.MongoClient.connect(
    module.config.uri,
    module.config,
    function(err, db)
    {
      if (err)
      {
        done(err);
      }
      else
      {
        module.db = db;

        done();
      }
    }
  );
};
