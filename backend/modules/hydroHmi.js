'use strict';

exports.DEFAULT_CONFIG = {
  modbusId: 'modbus',
  hydroHmiMaster: 'hydroHmi'
};

exports.start = function startHydroHmiModule(app, module)
{
  var defs = [
    {tag: 'outputPumps.1.status'}, // s1 pump 1
    {tag: 'outputPumps.2.status'}, // s1 pump 2
    {tag: 'outputPumps.3.status'}, // s1 pump 3
    null, // s1 meter (motor [RPM])
    {tag: 'outputPumps.current', mul: 100}, // s1 left value (motor [A])
    {tag: 'outputPumps.outputFrequency'}, // s1 right value (motor [Hz])
    {tag: 'reservoirs.1.waterLevel', mul: 100}, // s2 water level 1 value
    null, // s2 water level 1 fill
    {tag: 'reservoirs.2.waterLevel', mul: 100}, // s2 water level 2 value
    null, // s2 water level 2 fill
    {tag: 'outputPumps.dryRun'}, // s3 dry run indicator
    {tag: 'outputPressure', mul: 10} // s3 output pressure value
  ];

  app.onModuleReady(module.config.modbusId, function()
  {
    if (!app[module.config.modbusId].masters[module.config.hydroHmiMaster])
    {
      return module.debug("Ignored: hydroHmi master does not exist");
    }

    defs.forEach(mirrorTagValue);

    mirrorWaterLevelRegister('reservoirs.1', 7);
    mirrorWaterLevelRegister('reservoirs.2', 9);
  });

  /**
   * @private
   * @param {object} def
   * @param {number} register
   */
  function mirrorTagValue(def, register)
  {
    if (def == null || typeof def !== 'object')
    {
      return;
    }

    var mul = def.mul || 1;
    var hydroHmi =
      app[module.config.modbusId].masters[module.config.hydroHmiMaster];

    app.broker.subscribe('tagValueChanged.' + def.tag, function(message)
    {
      if (!hydroHmi.isConnected())
      {
        return;
      }

      hydroHmi.writeSingleRegister(register, message.newValue * mul);
    });
  }

  /**
   * @private
   * @param {string} tagPrefix
   * @param {number} register
   */
  function mirrorWaterLevelRegister(tagPrefix, register)
  {
    var topic = 'tagValueChanged.' + tagPrefix + '.waterLevel';
    var maxCapacityTag = tagPrefix + '.height';
    var modbus = app[module.config.modbusId];
    var hydroHmi = modbus.masters[module.config.hydroHmiMaster];

    app.broker.subscribe(topic, function(message)
    {
      if (!hydroHmi.isConnected())
      {
        return;
      }

      var maxCapacity = modbus.values[maxCapacityTag] || 1;
      var waterLevel = Math.round(message.newValue * 100 / maxCapacity);

      hydroHmi.writeSingleRegister(register, waterLevel);
    });
  }
};
