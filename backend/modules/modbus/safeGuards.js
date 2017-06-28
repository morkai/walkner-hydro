// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

const _ = require('lodash');

module.exports = function setUpTagSafeGuards(app, modbus)
{
  const openingValves = [];
  let lastValveOpenedAt = 0;

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
    app.broker.subscribe('beforeWriteTagValue.inputPumps.2.control', function(state)
    {
      if (!state.allowWrite || !state.newValue)
      {
        return;
      }

      state.allowWrite = !modbus.values['washingPump.status'];
    });
  }

  /**
   * @private
   */
  function safeGuardWashingPump()
  {
    app.broker.subscribe('beforeWriteTagValue.washingPump.control', function(state)
    {
      if (!state.allowWrite || !state.newValue)
      {
        return;
      }

      state.allowWrite = !modbus.values['inputPumps.2.status'];
    });
  }

  /**
   * @private
   */
  function safeGuardOutputPumps()
  {
    const outputPumpCount = app[modbus.config.programId].config.outputPumpCount;

    for (let i = 1; i <= outputPumpCount; ++i)
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
    const vfdControlTag = tagPrefix + '.control.vfd';
    const gridControlTag = tagPrefix + '.control.grid';

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
   * @param {Object} state
   */
  function checkOutputPumpControl(tagPrefix, vfd, state)
  {
    if (!state.allowWrite || !state.newValue)
    {
      return;
    }

    const outputPumpCount = app[modbus.config.programId].config.outputPumpCount;
    const vfdStatusTag = tagPrefix + '.status.vfd';
    const gridStatusTag = tagPrefix + '.status.grid';

    if (vfd)
    {
      state.allowWrite = !modbus.values[gridStatusTag];

      for (let i = 1; i <= outputPumpCount; ++i)
      {
        const vfdStatusTagN = 'outputPumps.' + i + '.status.vfd';

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
        const valveOpenDelay = modbus.values['filterSets.valveOpenDelay'];

        if (!state.allowWrite
          || !state.newValue
          || !_.isNumber(valveOpenDelay)
          || valveOpenDelay <= 0)
        {
          return;
        }

        const matches = topic.match(/\.([0-9]+)\.valves\.([0-9]+)\./);
        const valve = matches[1] + matches[2];
        const valveIndex = openingValves.indexOf(valve);
        const diff = Date.now() - lastValveOpenedAt;

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
