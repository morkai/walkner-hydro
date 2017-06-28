// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var _ = require('lodash');

module.exports = function setUpUpdaterRoutes(app, updaterModule)
{
  var express = app[updaterModule.config.expressId];

  _.forEach(updaterModule.config.manifests, function(manifestOptions)
  {
    express.get(manifestOptions.path, function(req, res)
    {
      var template = manifestOptions.template || updaterModule.manifest;

      if (app.options.env === 'development' || typeof template !== 'string')
      {
        return res.sendStatus(404);
      }

      var cacheManifest = template
        .replace('{version}', 'v' + updaterModule.getFrontendVersion(manifestOptions.frontendVersionKey))
        .replace('{mainJsFile}', manifestOptions.mainJsFile)
        .replace('{mainCssFile}', manifestOptions.mainCssFile);

      res.type('text/cache-manifest');
      res.send(cacheManifest);
    });
  });
};
