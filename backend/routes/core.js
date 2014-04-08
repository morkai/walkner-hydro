// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var lodash = require('lodash');
var requirejsConfig = require('../../config/require');

module.exports = function startCoreRoutes(app, express)
{
  var requirejsPaths = JSON.stringify(requirejsConfig.paths);
  var requirejsShim = JSON.stringify(requirejsConfig.shim);

  express.get('/', showIndex);

  express.get('/time', function(req, res)
  {
    res.send(Date.now().toString());
  });

  express.get('/config.js', sendRequireJsConfig);

  function showIndex(req, res)
  {
    if (!lodash.isObject(req.session))
    {
      return res.render('login');
    }

    var user = req.session.user;

    if (!lodash.isObject(user) || !user.loggedIn)
    {
      return res.render('login');
    }

    res.render('index', {
      locale: user.locale || 'pl',
      user: lodash.merge(user, {
        ipAddress: req.connection.address().address
      }),
      tagValues: app.controller && app.controller.values
        ? app.controller.values
        : {}
    });
  }

  function sendRequireJsConfig(req, res)
  {
    res.type('js');
    res.render('config.js.ejs', {
      paths: requirejsPaths,
      shim: requirejsShim
    });
  }
};
