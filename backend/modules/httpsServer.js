// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var util = require('util');
var https = require('https');
var domain = require('domain');
var fs = require('fs');

exports.DEFAULT_CONFIG = {
  expressId: 'express',
  host: '0.0.0.0',
  port: 443,
  key: 'privatekey.pem',
  cert: 'certificate.pem'
};

exports.start = function startHttpServerModule(app, module, done)
{
  function onFirstServerError(err)
  {
    if (err.code === 'EADDRINUSE')
    {
      return done(new Error(util.format(
        "port %d already in use?", module.config.port
      )));
    }
    else
    {
      return done(err);
    }
  }

  var serverDomain = domain.create();

  serverDomain.run(function()
  {
    var options = {
      key: fs.readFileSync(module.config.key),
      cert: fs.readFileSync(module.config.cert)
    };

    module.server = https.createServer(options, function onRequest(req, res)
    {
      var reqDomain = domain.create();

      reqDomain.add(req);
      reqDomain.add(res);

      reqDomain.on('error', function onRequestError(err)
      {
        if (err.code !== 'ECONNRESET')
        {
          module.error(err.stack || err.message || err);
        }

        reqDomain.dispose();

        try
        {
          res.statusCode = 500;
          res.end();
        }
        catch (err)
        {
          module.error(err.stack);
        }
      });

      var expressApp = app[module.config.expressId].app;

      if (expressApp)
      {
        expressApp(req, res);
      }
      else
      {
        res.writeHead(503);
        res.end();
      }
    });

    module.server.once('error', onFirstServerError);

    module.server.listen(module.config.port, module.config.host, function()
    {
      module.server.removeListener('error', onFirstServerError);

      module.debug("Listening on port %d...", module.config.port);

      return done();
    });
  });
};
