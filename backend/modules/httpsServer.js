'use strict';

var util = require('util');
var https = require('https');
var domain = require('domain');
var fs = require('fs');

exports.DEFAULT_CONFIG = {
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

    app.httpsServer = https.createServer(options, function onRequest(req, res)
    {
      var reqDomain = domain.create();

      reqDomain.add(req);
      reqDomain.add(res);

      reqDomain.on('error', function onRequestError(err)
      {
        if (err.code !== 'ECONNRESET')
        {
          module.error(err.message);
        }

        reqDomain.dispose();
      });

      app.express(req, res);
    });

    app.httpsServer.once('error', onFirstServerError);

    app.httpsServer.listen(module.config.port, module.config.host, function()
    {
      app.httpsServer.removeListener('error', onFirstServerError);

      module.debug("Listening on port %d...", module.config.port);

      return done();
    });
  });
};
