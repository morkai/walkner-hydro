'use strict';

var lodash = require('lodash');

exports.DEFAULT_CONFIG = {
  messengerClientId: 'messenger/client',
  sioId: 'sio'
};

exports.start = function startHealthEndpointModule(app, module)
{
  var messengerClient;
  var tagPrefix = 'health.' + app.options.id;
  var websockets = 0;
  var scheduleSendSioData = lodash.throttle(sendSioData, 5000);

  app.onModuleReady(module.config.messengerClientId, function()
  {
    messengerClient = app[module.config.messengerClientId];

    app.onModuleReady(module.config.sioId, setUpSioModule);

    sendMemoryData();
    sendUptimeData();
  });

  /**
   * @private
   */
  function setUpSioModule()
  {
    var sio = app[module.config.sioId];

    sio.sockets.on('connection', function(socket)
    {
      ++websockets;

      scheduleSendSioData();

      socket.on('disconnect', function()
      {
        --websockets;

        scheduleSendSioData();
      });
    });
  }

  /**
   * @private
   */
  function sendMemoryData()
  {
    messengerClient.request('modbus.setTagValue', {
      name: tagPrefix + '.memory',
      value: roundBytes(process.memoryUsage().rss)
    });

    setTimeout(sendMemoryData, 1000);
  }

  /**
   * @private
   */
  function sendUptimeData()
  {
    messengerClient.request('modbus.setTagValue', {
      name: tagPrefix + '.uptime',
      value: Math.round(process.uptime())
    });

    setTimeout(sendUptimeData, 60000);
  }

  /**
   * @private
   */
  function sendSioData()
  {
    messengerClient.request('modbus.setTagValue', {
      name: tagPrefix + '.websockets',
      value: websockets
    });
  }

  /**
   * @private
   * @param {number} bytes
   * @returns {number}
   */
  function roundBytes(bytes)
  {
    return Math.round(bytes / 1024 / 1024 * 1000) / 1000;
  }
};
