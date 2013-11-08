'use strict';

var path = require('path');
var lodash = require('lodash');
var express = require('express');
var ejsAmd = require('ejs-amd');
var messageFormatAmd = require('messageformat-amd');
var MongoStore = require('./MongoStore')(express.session.Store);
var wrapAmd = require('./wrapAmd');
var rqlMiddleware = require('./rqlMiddleware');

exports.DEFAULT_CONFIG = {
  mongooseId: 'mongoose',
  staticPath: 'public',
  staticBuildPath: 'public-build',
  sessionCookieKey: 'walkner.sid',
  cookieSecret: 'sec~1ee7~ret',
  ejsAmdHelpers: {}
};

exports.start = function startExpressModule(app, module, done)
{
  var mongoose = app[module.config.mongooseId];

  if (!mongoose)
  {
    return done(new Error("express module requires the mongoose module!"));
  }

  module = app[module.name] = lodash.merge(express(), module);

  var production = app.options.env === 'production';
  var staticPath = module.config[production ? 'staticBuildPath' : 'staticPath'];

  module.set('views', app.pathTo('templates'));
  module.set('view engine', 'ejs');
  module.set('static path', staticPath);

  if (!production)
  {
    setUpDevMiddleware(staticPath);
  }

  module.sessionStore = new MongoStore(mongoose.connection.db);

  module.use(express.cookieParser(module.config.cookieSecret));
  module.use(express.session({
    store: module.sessionStore,
    key: module.config.sessionCookieKey,
    cookie: {
      maxAge: 3600 * 24 * 30 * 1000,
      path: '/',
      httpOnly: true
    }
  }));
  module.use(express.bodyParser());
  module.use(express.methodOverride());
  module.use(rqlMiddleware());
  module.use(module.router);
  module.use(express.static(staticPath));

  if (production)
  {
    module.use(express.errorHandler());
  }
  else
  {
    module.use(express.errorHandler({
      dumpExceptions: true,
      showStack: true
    }));
  }

  app.loadDir(app.pathTo('routes'), [app, module], done);

  /**
   * @private
   * @param {string} staticPath
   */
  function setUpDevMiddleware(staticPath)
  {
    ejsAmd.wrapAmd = wrapEjsAmd.bind(null, module.config.ejsAmdHelpers);

    var templateUrlRe = /^\/app\/([a-z0-9\-]+)\/templates\/(.*?)\.js$/;
    var ejsAmdMiddleware = ejsAmd.middleware({
      views: staticPath
    });

    module.use(function(req, res, next)
    {
      var matches = req.url.match(templateUrlRe);

      if (matches === null)
      {
        return next();
      }

      ejsAmdMiddleware(req, res, next);
    });

    module.use('/app/nls/locale/', messageFormatAmd.localeMiddleware());

    module.use('/app/nls/', messageFormatAmd.nlsMiddleware({
      localeModulePrefix: 'app/nls/locale/',
      jsonPath: function(locale, nlsName)
      {
        var jsonFile = (locale === null ? 'root' : locale) + '.json';

        return path.join(staticPath, 'app', nlsName, 'nls', jsonFile);
      }
    }));
  }

  /**
   * @private
   * @param {object} ejsAmdHelpers
   * @param {string} js
   * @returns {string}
   */
  function wrapEjsAmd(ejsAmdHelpers, js)
  {
    return wrapAmd('return ' + js, ejsAmdHelpers);
  }
};
