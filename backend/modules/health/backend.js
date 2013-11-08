'use strict';

var os = require('os');

exports.DEFAULT_CONFIG = {
  modbusId: 'modbus'
};

exports.start = function startHealthBackendModule(app, module)
{
  var modbus;
  var tagPrefix = 'health.' + app.options.id;

  app.onModuleReady(module.config.modbusId, function()
  {
    modbus = app[module.config.modbusId];

    sendMemoryData();
    sendUptimeAndLoadData();
  });

  /**
   * @private
   */
  function sendMemoryData()
  {
    modbus.tags[tagPrefix + '.memory'].setValue(
      roundBytes(process.memoryUsage().rss)
    );
    modbus.tags['health.os.memory'].setValue(
      roundBytes(os.totalmem() - os.freemem())
    );

    setTimeout(sendMemoryData, 1000);
  }

  /**
   * @private
   */
  function sendUptimeAndLoadData()
  {
    modbus.tags[tagPrefix + '.uptime'].setValue(Math.round(process.uptime()));
    modbus.tags['health.os.uptime'].setValue(Math.round(os.uptime()));
    modbus.tags['health.os.cpu'].setValue(os.loadavg()[0]);

    setTimeout(sendUptimeAndLoadData, 60000);
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
