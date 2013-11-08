'use strict';

var lodash = require('lodash');
var sio = require('socket.io');
var SocketIoMultiServer = require('./SocketIoMultiServer');

exports.DEFAULT_CONFIG = {
  httpServerId: 'httpServer',
  httpsServerId: 'httpsServer'
};

exports.start = function startIoModule(app, module)
{
  var httpServer = app[module.config.httpServerId];
  var httpsServer = app[module.config.httpsServerId];

  if (!httpServer && !httpsServer)
  {
    throw new Error("sio module requires the httpServer(s) module");
  }

  var multiServer = new SocketIoMultiServer();

  if (httpServer)
  {
    multiServer.addServer(httpServer);
  }

  if (httpsServer)
  {
    multiServer.addServer(httpsServer);
  }

  module = app[module.name] = lodash.merge(
    sio.listen(multiServer, {log: false}), module
  );

  module.set('transports', ['websocket', 'xhr-polling']);
  module.disable('browser client');

  if (app.options.env === 'production')
  {
    module.enable('browser client minification');
    module.enable('browser client etag');
    module.enable('browser client gzip');
  }

  module.sockets.on('connection', function(socket)
  {
    socket.on('echo', function()
    {
      socket.emit.apply(
        socket, ['echo'].concat(Array.prototype.slice.call(arguments))
      );
    });

    socket.on('time', function(reply)
    {
      if (typeof reply === 'function')
      {
        reply(Date.now());
      }
    });
  });
};
