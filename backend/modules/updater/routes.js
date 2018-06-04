// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');

module.exports = function setUpUpdaterRoutes(app, updaterModule)
{
  const express = app[updaterModule.config.expressId];

  _.forEach(updaterModule.config.manifests, function(manifestOptions)
  {
    express.get(manifestOptions.path, function(req, res)
    {
      const template = manifestOptions.template || updaterModule.manifest;

      if (app.options.env === 'development' || typeof template !== 'string')
      {
        return res.sendStatus(404);
      }

      const cacheManifest = template
        .replace('{version}', 'v' + updaterModule.getFrontendVersion(manifestOptions.frontendVersionKey))
        .replace('{mainJsFile}', manifestOptions.mainJsFile)
        .replace('{mainCssFile}', manifestOptions.mainCssFile);

      res.type('text/cache-manifest');
      res.send(cacheManifest);
    });
  });
};
