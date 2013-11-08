'use strict';

var lodash = require('lodash');

module.exports = function setUpTagSafeGuards(app, modbus)
{
  var lastValveOpenedAt = 0;
  var openingValves = [];

  app.onModuleReady(modbus.config.programId, function()
  {
    safeGuardInputPump2();
    safeGuardWashingPump();
    safeGuardOutputPumps();
    safeGuardFilterSetValves();
  });

  /**
   * @private
   */
  function safeGuardInputPump2()
  {
    app.broker.subscribe(
      'beforeWriteTagValue.inputPumps.2.control',
      function(state)
      {
        if (!state.allowWrite || !state.newValue)
        {
          return;
        }

        state.allowWrite = !modbus.values['washingPump.status'];
      }
    );
  }

  /**
   * @private
   */
  function safeGuardWashingPump()
  {
    app.broker.subscribe(
      'beforeWriteTagValue.washingPump.control',
      function(state)
      {
        if (!state.allowWrite || !state.newValue)
        {
          return;
        }

        state.allowWrite = !modbus.values['inputPumps.2.status'];
      }
    );
  }

  /**
   * @private
   */
  function safeGuardOutputPumps()
  {
    var outputPumpCount = app[modbus.config.programId].config.outputPumpCount;

    for (var i = 1; i <= outputPumpCount; ++i)
    {
      safeGuardOutputPumpControlTag('outputPumps.' + i);
    }
  }

  /**
   * @private
   * @param {string} tagPrefix
   */
  function safeGuardOutputPumpControlTag(tagPrefix)
  {
    var vfdControlTag = tagPrefix + '.control.vfd';
    var gridControlTag = tagPrefix + '.control.grid';

    app.broker.subscribe(
      'beforeWriteTagValue.' + vfdControlTag,
      checkOutputPumpControl.bind(null, tagPrefix, true)
    );

    app.broker.subscribe(
      'beforeWriteTagValue.' + gridControlTag,
      checkOutputPumpControl.bind(null, tagPrefix, false)
    );
  }

  /**
   * @private
   * @param {string} tagPrefix
   * @param {boolean} vfd
   * @param {object} state
   */
  function checkOutputPumpControl(tagPrefix, vfd, state)
  {
    if (!state.allowWrite || !state.newValue)
    {
      return;
    }

    var outputPumpCount = app[modbus.config.programId].config.outputPumpCount;
    var vfdStatusTag = tagPrefix + '.status.vfd';
    var gridStatusTag = tagPrefix + '.status.grid';

    if (vfd)
    {
      state.allowWrite = !modbus.values[gridStatusTag];

      for (var i = 1; i <= outputPumpCount; ++i)
      {
        var vfdStatusTagN = 'outputPumps.' + i + '.status.vfd';

        if (state.allowWrite && vfdStatusTagN !== vfdStatusTag)
        {
          state.allowWrite = !modbus.values[vfdStatusTagN];
        }
      }
    }
    else
    {
      state.allowWrite = !modbus.values[vfdStatusTag];
    }
  }

  function safeGuardFilterSetValves()
  {
    app.broker
      .subscribe('beforeWriteTagValue.filterSets.*.valves.*.control')
      .on('message', function beforeFilterSetValveControlWrite(state, topic)
      {
        var valveOpenDelay = modbus.values['filterSets.valveOpenDelay'];

        if (!state.allowWrite
          || !state.newValue
          || !lodash.isNumber(valveOpenDelay)
          || valveOpenDelay <= 0)
        {
          return;
        }

        var matches = topic.match(/\.([0-9]+)\.valves\.([0-9]+)\./);
        var valve = matches[1] + matches[2];
        var valveIndex = openingValves.indexOf(valve);
        var diff = Date.now() - lastValveOpenedAt;

        if (diff >= valveOpenDelay)
        {
          if (valveIndex === -1)
          {
            lastValveOpenedAt = Date.now();

            return;
          }

          if (valveIndex === 0)
          {
            lastValveOpenedAt = Date.now();

            openingValves.shift();

            return;
          }

          state.writeDelay = valveOpenDelay;

          return;
        }

        if (valveIndex === -1)
        {
          openingValves.push(valve);
        }

        state.writeDelay = valveOpenDelay - diff;
      });
  }
};
