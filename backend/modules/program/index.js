'use strict';

var lodash = require('lodash');
var AirValve = require('./AirValve');
var Blower = require('./Blower');
var UvLamp = require('./UvLamp');
var WashingPump = require('./WashingPump');
var Reservoirs = require('./Reservoirs');
var FilterSets = require('./FilterSets');
var InputPumps = require('./InputPumps');
var OutputPumps = require('./OutputPumps');
var simulator = require('./simulator');

exports.DEFAULT_CONFIG = {
  modbusId: 'modbus',
  simulate: false,
  inputPumpCount: 1,
  filterSetCount: 1,
  reservoirCount: 1,
  outputPumpCount: 1
};

exports.start = function startProgramModule(app, module)
{
  var config = module.config;
  var execQueue = null;

  module.exec = function(func, name)
  {
    if (execQueue === null)
    {
      execQueue = {};

      process.nextTick(function()
      {
        var queue = execQueue;

        execQueue = null;

        lodash.each(queue, function(func) { func(); });
      });
    }

    execQueue[name || func.name] = func;
  };

  var modbus = app[module.config.modbusId];

  if (config.simulate)
  {
    simulator(app, modbus);
  }

  var masterStatusTag = 'masters.controlProcess';

  if (config.simulate || modbus.values[masterStatusTag])
  {
    init();
  }
  else
  {
    app.broker
      .subscribe('tagValueChanged.' + masterStatusTag, init)
      .setLimit(1);
  }

  function init()
  {
    app.timeout(1337, function()
    {
      app.program.airValve = new AirValve(app.broker, modbus, module);
      app.program.blower = new Blower(app.broker, modbus, module);
      app.program.uvLamp = new UvLamp(app.broker, modbus, module);
      app.program.washingPump = new WashingPump(app.broker, modbus, module);
      app.program.reservoirs = new Reservoirs(app.broker, modbus, module);
      app.program.filterSets = new FilterSets(app.broker, modbus, module);
      app.program.inputPumps = new InputPumps(app.broker, modbus, module);
      app.program.outputPumps = new OutputPumps(app.broker, modbus, module);
    });
  }
};
