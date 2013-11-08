'use strict';

var lodash = require('lodash');
var step = require('h5.step');

exports.DEFAULT_CONFIG = {
  messengerServerId: 'messenger/server',
  modbusId: 'modbus',
  timeWindows: {
    true: 60 * 60 * 1000,
    false: 60 * 1000
  },
  defaultTimeout: 30
};

exports.start = function startBreakinBackendModule(app, module)
{
  var modbus = app[module.config.modbusId];

  if (!modbus)
  {
    throw new Error(
      "breakin/backend module requires the modbus module!"
    );
  }

  app.onModuleReady(
    module.config.messengerServerId, setUpMessengerServerModule
  );

  var alarmTimer = null;
  var checkTimer = null;
  var checkStartAlarm = lodash.debounce(startAlarm, 25);

  app.broker.subscribe('tagValueChanged.breakin.hydro', checkStartAlarm);
  app.broker.subscribe('tagValueChanged.breakin.chlor', checkStartAlarm);
  app.broker.subscribe('tagValueChanged.breakin.inputPump1', checkStartAlarm);
  app.broker.subscribe('tagValueChanged.breakin.inputPump2', checkStartAlarm);

  /**
   * @private
   */
  function setUpMessengerServerModule()
  {
    var messengerServer = app[module.config.messengerServerId];

    messengerServer.handle('breakin.stopAlarm', stopAlarm);

    messengerServer.handle('breakin.operatorLoggedIn', operatorLoggedIn);
  }

  /**
   * @private
   */
  function startAlarm()
  {
    if (checkTimer !== null)
    {
      clearTimeout(checkTimer);
      checkTimer = null;
    }

    var val = modbus.values;

    if (!val['breakin.hydro']
      && !val['breakin.chlor']
      && !val['breakin.inputPump1']
      && !val['breakin.inputPump2'])
    {
      return;
    }

    var timeWindow =
      module.config.timeWindows[!!val['breakin.operatorLoggedIn']];
    var stateTag = modbus.tags['breakin.state'];
    var lastChangeDiff = Date.now() - (stateTag ? stateTag.lastChangeTime : 0);

    if (lastChangeDiff < timeWindow)
    {
      checkTimer = app.timeout(timeWindow - lastChangeDiff, checkStartAlarm);

      return;
    }

    var timeout = val['breakin.timeout'];

    if (isNaN(timeout) || typeof timeout !== 'number' || timeout < 1)
    {
      timeout = module.config.defaultTimeout;
    }

    if (val['breakin.chlor']
      || val['breakin.inputPump1']
      || val['breakin.inputPump2'])
    {
      process.nextTick(scream);
    }
    else
    {
      alarmTimer = app.timeout(timeout * 1000, scream);
    }

    stateTag.writeValue(true, function(err)
    {
      if (err)
      {
        module.error("Failed to enable breakin state: %s", err.message);
      }
    });
  }

  /**
   * @private
   * @param {object} req
   * @param {function} reply
   */
  function stopAlarm(req, reply)
  {
    if (alarmTimer !== null)
    {
      clearTimeout(alarmTimer);
      alarmTimer = null;
    }

    var lightsTag = modbus.tags['breakin.lights'];
    var soundsTag = modbus.tags['breakin.sounds'];
    var stateTag = modbus.tags['breakin.state'];

    var steps = [];

    if (lightsTag)
    {
      steps.push(function turnOffTheLightsStep()
      {
        lightsTag.writeValue(false, this.next());
      });
    }

    if (soundsTag)
    {
      steps.push(function turnOffTheSoundsStep(err)
      {
        if (err)
        {
          return this.skip(err);
        }

        soundsTag.writeValue(false, this.next());
      });
    }

    if (stateTag)
    {
      steps.push(function changeStateStep(err)
      {
        if (err)
        {
          return this.skip(err);
        }

        stateTag.writeValue(false, this.next());
      });
    }

    steps.push(reply);

    step(steps);
  }

  /**
   * @private
   * @param {object} req
   * @param {function} reply
   */
  function operatorLoggedIn(req, reply)
  {
    if (modbus.tags['breakin.operatorLoggedIn'])
    {
      modbus.tags['breakin.operatorLoggedIn'].writeValue(!!req.state, reply);
    }
    else
    {
      reply();
    }
  }

  /**
   * @private
   */
  function scream()
  {
    alarmTimer = null;

    if (modbus.tags['breakin.lights'])
    {
      modbus.tags['breakin.lights'].writeValue(true, function(err)
      {
        if (err)
        {
          module.error("Failed to enable breakin lights: %s", err.message);
        }
      });
    }

    if (modbus.tags['breakin.sounds'])
    {
      modbus.tags['breakin.sounds'].writeValue(true, function(err)
      {
        if (err)
        {
          module.error("Failed to enable breakin sounds: %s", err.message);
        }
      });
    }
  }
};
