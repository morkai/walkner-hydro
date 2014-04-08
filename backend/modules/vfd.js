// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var fs = require('fs');
var lodash = require('lodash');
var step = require('h5.step');
var Tag = require('./modbus/Tag');

exports.DEFAULT_CONFIG = {
  messengerServerId: 'messenger/server',
  modbusId: 'modbus',
  vfdMaster: 'vfd',
  paramsFile: 'vfd.txt'
};

exports.start = function startVfdModule(app, module)
{
  var messengerServer = app[module.config.messengerServerId];
  var modbus = app[module.config.modbusId];

  if (!messengerServer)
  {
    throw new Error("vfd module requires the messenger/server module!");
  }

  if (!modbus)
  {
    throw new Error("vfd module requires the modbus module!");
  }

  module.params = null;

  messengerServer.handle('vfd.readParam', handleReadParamMessage);
  messengerServer.handle('vfd.compareParams', handleCompareParamMessage);
  messengerServer.handle('vfd.writeParam', handleWriteParamMessage);

  function validateParamNo(no)
  {
    return lodash.isString(no) && (/^[0-9]+\-[0-9]+$/.test(no) || /^[0-9]{2}\.[0-9]{2}$/.test(no));
  }

  /**
   * @private
   * @param {object} req
   * @param {function} reply
   */
  function handleReadParamMessage(req, reply)
  {
    if (!validateParamNo(req.no))
    {
      return reply({message: 'VFD_INVALID_PARAM_NO'});
    }

    req.master = modbus.masters[req.master || 'vfd'];

    if (lodash.isUndefined(req.master))
    {
      return reply({message: 'VFD_UNKNOWN_MASTER'});
    }

    req.unit = parseInt(req.unit, 10) || 1;

    if (isNaN(req.unit) || req.unit < 1 || req.unit > 100)
    {
      return reply({message: 'VFD_INVALID_UNIT'});
    }

    getParamInfo(req.no, function(err, paramInfo)
    {
      if (err)
      {
        return reply(err);
      }

      readParam(req, paramInfo, reply);
    });
  }

  /**
   * @private
   * @param {object} req
   * @param {function} reply
   */
  function handleWriteParamMessage(req, reply)
  {
    if (!validateParamNo(req.no))
    {
      return reply({message: 'VFD_INVALID_PARAM_NO'});
    }

    var master = modbus.masters[req.master || 'vfd'];

    if (lodash.isUndefined(master))
    {
      return reply({message: 'VFD_UNKNOWN_MASTER'});
    }

    req.unit = parseInt(req.unit, 10) || 1;

    if (isNaN(req.unit) || req.unit < 1 || req.unit > 100)
    {
      return reply({message: 'VFD_INVALID_UNIT'});
    }

    getParamInfo(req.no, function(err, paramInfo)
    {
      if (err)
      {
        return reply(err);
      }

      writeParam(req, paramInfo, reply);
    });
  }

  /**
   * @private
   * @param {string} paramNo
   * @param {function(Error|null)} done
   */
  function getParamInfo(paramNo, done)
  {
    if (module.params !== null)
    {
      if (lodash.isUndefined(module.params[paramNo]))
      {
        if (paramNo.indexOf('.') === -1)
        {
          return done({message: 'VFD_UNKNOWN_PARAM'});
        }

        module.params[paramNo] = {
          no: paramNo,
          type: 'uint16',
          name: paramNo + '???',
          workWrite: 'n/a',
          cIdx: 'n/a',
          sets: 'n/a'
        };
      }

      return done(null, module.params[paramNo]);
    }

    loadParamInfo(function(err)
    {
      if (err)
      {
        return done(err);
      }

      if (lodash.isUndefined(module.params[paramNo]))
      {
        return done({message: 'VFD_UNKNOWN_PARAM'});
      }

      return done(null, module.params[paramNo]);
    });
  }

  /**
   * @private
   * @param {function(Error|null)} done
   */
  function loadParamInfo(done)
  {
    if (module.params !== null)
    {
      return done(null);
    }

    fs.readFile(module.config.paramsFile, 'utf8', function(err, data)
    {
      if (err)
      {
        return done(err);
      }

      data.split('\n').forEach(function(line)
      {
        line = line.trim();

        var words = line
          .split(' ')
          .filter(function(word) { return word !== ''; });

        if (words.length < 2)
        {
          return;
        }

        var no = words.shift();

        if (!validateParamNo(no))
        {
          return;
        }

        var type = words.pop().toLowerCase();
        var cIdx = words.pop();
        var workWrite = words.pop();
        var sets = words.pop();

        sets = words.pop() + ' ' + sets;
        sets = words.pop() + ' ' + sets;

        if (module.params === null)
        {
          module.params = {};
        }

        module.params[no] = {
          no: no,
          type: type,
          name: words.join(' '),
          workWrite: workWrite,
          cIdx: cIdx,
          sets: sets
        };
      });

      done(null);
    });
  }

  /**
   * @private
   * @param {string} paramNo
   * @returns {number}
   */
  function getParamAddress(paramNo)
  {
    if (paramNo.indexOf('.') !== -1)
    {
      return parseInt('0x' + paramNo.replace('.', ''), 16);
    }

    paramNo = paramNo.split('-');

    return parseInt(paramNo[0], 10) * 1000 + parseInt(paramNo[1], 10) * 10 - 1;
  }

  /**
   * @private
   * @param {string} paramType
   * @returns {number}
   */
  function getParamSize(paramType)
  {
    /*jshint -W015*/

    switch (paramType)
    {
      case 'uint32':
      case 'int32':
        return 2;

      case 'timeofday':
        return 4;

      default:
        if (paramType.indexOf('visstr[') === 0)
        {
          return Math.min(10, parseInt(paramType.substring(7, paramType.length - 1), 10));
        }

        return 1;
    }
  }

  /**
   * @private
   * @param {object} req
   * @param {object} paramInfo
   * @param {function(Error|null), object} reply
   */
  function readParam(req, paramInfo, reply)
  {
    var address = getParamAddress(paramInfo.no);
    var quantity = getParamSize(paramInfo.type);

    req.master.readHoldingRegisters(address, quantity, {
      unit: req.unit,
      timeout: 200,
      maxRetries: 0,
      onComplete: function(err, res)
      {
        if (err)
        {
          return reply(err);
        }

        if (res.isException())
        {
          return reply({message: res.toString()});
        }

        var param = {
          value: readParamValue(paramInfo.type, res.getValues())
        };

        lodash.merge(param, paramInfo);

        reply(null, param);
      }
    });
  }

  /**
   * @private
   * @param {string} paramType
   * @param {Buffer} buffer
   * @returns {number|string}
   */
  function readParamValue(paramType, buffer)
  {
    /*jshint -W015*/

    switch (paramType)
    {
      case 'uint32':
        return buffer.readUInt32BE(0);

      case 'uint16':
      case 'uint8':
      case 'n2':
        return buffer.readUInt16BE(0);

      case 'int32':
        return buffer.readInt32BE(0);

      case 'int16':
      case 'int8':
        return buffer.readInt16BE(0);

      case 'v2':
        var bits = buffer.readUInt16BE(0).toString(2);

        while (bits.length < 16)
        {
          bits = '0' + bits;
        }

        return bits;

      default:
        if (paramType.indexOf('visstr') === 0)
        {
          return buffer.toString();
        }

        var hex = [];

        for (var i = 0; i < buffer.length; ++i)
        {
          hex.push(buffer[i].toString(16));
        }

        return hex.join(' ');
    }
  }

  /**
   * @private
   * @param {object} req
   * @param {object} paramInfo
   * @param {function(Error|null, object)} reply
   */
  function writeParam(req, paramInfo, reply)
  {
    var address = getParamAddress(paramInfo.no);

    var tag = new Tag(app.broker, modbus, paramInfo.no, {
      master: req.master || 'vfd',
      address: address,
      unit: req.unit,
      description: paramInfo.name,
      kind: 'register',
      code: 0x03,
      type: paramInfo.type,
      readable: false,
      writable: true
    });

    tag.writeValue(req.value, function(err)
    {
      if (typeof err === 'string')
      {
        return reply({message: err});
      }

      if (err)
      {
        return reply(err);
      }

      var param = {value: req.value};

      lodash.merge(param, paramInfo);

      reply(null, param);
    });
  }

  /**
   * @private
   * @param {object} req
   * @param {function(Error|null)} reply
   */
  function handleCompareParamMessage(req, reply)
  {
    loadParamInfo(function(err)
    {
      if (err)
      {
        return reply(err);
      }

      reply(null);

      messengerServer.broadcast('vfd.comparingParams', true);

      var params = Object.keys(module.params);

      compareNextParam(params, 0);
    });
  }

  /**
   * @private
   * @param {Array.<string>} params
   * @param {number} i
   */
  function compareNextParam(params, i)
  {
    var paramInfo = module.params[params.shift()];

    if (lodash.isUndefined(paramInfo))
    {
      messengerServer.broadcast('vfd.comparingParams', false);

      return;
    }

    step(
      function readParams()
      {
        readParam(
          {master: modbus.masters[module.config.vfdMaster], unit: 1},
          paramInfo,
          this.parallel()
        );
        readParam(
          {master: modbus.masters[module.config.vfdMaster], unit: 3},
          paramInfo,
          this.parallel()
        );
      },
      function compareParams(err, param1, param3)
      {
        if (!err && param1.value !== param3.value)
        {
          param1.values = [param1.value, param3.value];

          delete param1.value;

          messengerServer.broadcast('vfd.paramDiff', param1);
        }

        process.nextTick(compareNextParam.bind(null, params, i + 1));
      }
    );
  }
};
