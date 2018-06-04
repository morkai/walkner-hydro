// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const util = require('util');
const https = require('https');
const domain = require('domain');
const fs = require('fs');

exports.DEFAULT_CONFIG = {
  expressId: 'express',
  host: '0.0.0.0',
  port: 443,
  key: 'privatekey.pem',
  cert: 'certificate.pem',
  availabilityTopics: []
};

exports.start = function startHttpServerModule(app, module, done)
{
  let availabilityTopics = module.config.availabilityTopics.slice();

  availabilityTopics.forEach(topic =>
  {
    app.broker.subscribe(topic).setLimit(1).on('message', () =>
    {
      availabilityTopics = availabilityTopics.filter(t => t !== topic);
    });
  });

  module.isAvailable = () => availabilityTopics.length === 0;

  function onFirstServerError(err)
  {
    if (err.code === 'EADDRINUSE')
    {
      return done(new Error(util.format(
        'port %d already in use?', module.config.port
      )));
    }

    return done(err);
  }

  const serverDomain = domain.create();

  serverDomain.run(function()
  {
    const options = {
      key: fs.readFileSync(module.config.key),
      cert: fs.readFileSync(module.config.cert)
    };

    module.server = https.createServer(options, function onRequest(req, res)
    {
      const reqDomain = domain.create();

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

      const expressModule = app[module.config.expressId];

      if (module.isAvailable() && expressModule)
      {
        expressModule.app(req, res);
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

      module.debug('Listening on port %d...', module.config.port);

      return done();
    });
  });
};
