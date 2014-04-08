// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var fs = require('fs');
var csv = require('csv');
var lodash = require('lodash');
var modbus = require('h5.modbus');
var Tag = require('./Tag');

exports.DEFAULT_CONFIG = {
  messengerServerId: 'messenger/server',
  mongodbId: 'mongodb',
  programId: 'program',
  settingsCollection: function(app)
  {
    return app.mongodb.db.collection('settings');
  },
  broadcastDelay: 100,
  broadcastFilter: [],
  writeAllTheThings: null,
  maxReadQuantity: 100,
  ignoredErrors: [],
  controlMasters: [],
  masters: {},
  tagsFile: null,
  tags: {}
};

exports.start = function startModbusModule(app, module, done)
{
  module.config.settingsCollection =
    module.config.settingsCollection.bind(null, app);

  module.masters = {};
  module.tags = {};
  module.values = {};

  app.onModuleReady(module.config.messengerServerId, setUpServerMessages);

  if (module.config.tagsFile)
  {
    importTagsCsv(module.config.tagsFile, module.config.tags, setUpModule);
  }
  else
  {
    setUpModule();
  }

  /**
   * @private
   */
  function setUpModule()
  {
    setUpMasters();
    setUpTags();
    setUpReadTransactions();

    app.onModuleReady(module.config.mongodbId, setUpSettingsTags);

    require('./virtuals')(app, module);
    require('./safeGuards')(app, module);

    done();
  }

  /**
   * @private
   */
  function setUpServerMessages()
  {
    var messengerServer = app[module.config.messengerServerId];

    messengerServer.handle('modbus.sync', function(req, reply)
    {
      reply(null, {
        tags: module.tags,
        values: module.values
      });
    });

    messengerServer.handle('modbus.setTagValue', handleSetTagValueMessage);

    setUpTagValuesBroadcast();
  }

  /**
   * @private
   */
  function setUpTagValuesBroadcast()
  {
    var messengerServer = app[module.config.messengerServerId];
    var pendingChanges = null;

    app.broker.subscribe('tagValueChanged.**', function(message)
    {
      if (!message.tag.broadcastable)
      {
        return;
      }

      if (pendingChanges === null)
      {
        pendingChanges = {};

        app.timeout(module.config.broadcastDelay, function()
        {
          messengerServer.broadcast('modbus.tagValuesChanged', pendingChanges);

          pendingChanges = null;
        });
      }

      pendingChanges[message.tag.name] = message.newValue;
    });
  }

  /**
   * @private
   * @param {object} req
   * @param {function} reply
   */
  function handleSetTagValueMessage(req, reply)
  {
    var tag = module.tags[req.name];

    if (typeof tag === 'undefined')
    {
      return reply('UNKNOWN_TAG');
    }

    if (req.value === tag.getValue())
    {
      return reply();
    }

    tag.writeValue(req.value, reply);
  }

  /**
   * @private
   * @param {string} csvPath
   * @param {object} tags
   * @param {function} done
   */
  function importTagsCsv(csvPath, tags, done)
  {
    var tagsCsv;

    try
    {
      tagsCsv = fs.readFileSync(csvPath, 'utf8');
    }
    catch (err)
    {
      return done();
    }

    var csvOptions = {
      delimiter: ',',
      rowDelimiter: '\n',
      quote: '"',
      trim: true,
      columns: true
    };

    var csvReader = csv().from.string(tagsCsv, csvOptions);

    csvReader.on('record', function(record)
    {
      Object.keys(record).forEach(function(key)
      {
        if (tags[record.name] !== undefined)
        {
          return;
        }

        if (/^[A-Z]/.test(key))
        {
          delete record[key];
          return;
        }

        if (record[key] === '-' || record[key] === '?')
        {
          record[key] = null;
        }
        else if (/^[0-9]+(\.[0-9]+)?$/.test(record[key]))
        {
          record[key] = parseFloat(record[key]);
        }
      });

      if (record.name === '')
      {
        return;
      }

      tags[record.name] = record;
    });

    csvReader.on('end', done);
  }

  /**
   * @private
   */
  function setUpMasters()
  {
    var config = module.config;

    Object.keys(config.masters).forEach(function createMaster(masterName)
    {
      var master = modbus.createMaster(config.masters[masterName]);

      master.tags = [];

      master.on('error', function(err)
      {
        if (config.ignoredErrors.indexOf(err.code) === -1)
        {
          app.broker.publish('modbus.error', {
            severity: 'debug',
            master: masterName,
            unit: -1,
            message: err.message,
            code: err.code
          });
        }
      });

      var statusTagName = 'masters.' + masterName;
      var wasConnected = false;
      var resetTagsTimer = null;

      master.on('transaction complete', function(err)
      {
        if (!wasConnected && !err)
        {
          module.debug("Master really connected: %s", masterName);

          wasConnected = true;

          module.tags[statusTagName].setValue(wasConnected);

          if (resetTagsTimer !== null)
          {
            clearTimeout(resetTagsTimer);
            resetTagsTimer = null;
          }
        }
      });

      master.on('connected', function()
      {
        module.debug("Master maybe connected: %s", masterName);
      });

      master.on('disconnected', function()
      {
        module.debug("Master disconnected: %s", masterName);

        wasConnected = false;

        module.tags[statusTagName].setValue(wasConnected);

        if (resetTagsTimer === null)
        {
          resetTagsTimer = app.timeout(1337, function()
          {
            resetTagsTimer = null;

            master.tags.forEach(function(tag) { tag.setValue(null); });
          });
        }
      });

      module.masters[masterName] = master;
    });
  }

  /**
   * @private
   */
  function setUpTags()
  {
    var config = module.config;

    Object.keys(module.masters).forEach(function addStatusTag(masterName)
    {
      var statusTagName = 'masters.' + masterName;
      var statusTag = config.tags[statusTagName];

      if (statusTag === null || typeof statusTag !== 'object')
      {
        statusTag = config.tags[statusTagName] = {};
      }

      statusTag.master = masterName;
      statusTag.kind = 'virtual';
      statusTag.type = 'bool';
      statusTag.address = null;
      statusTag.unit = null;
      statusTag.readable = false;
      statusTag.writable = false;

      module.values[statusTagName] = false;
    });

    var address = 0;

    Object.keys(config.tags).forEach(function setUpTag(tagName)
    {
      var tagConfig = config.tags[tagName];
      var master = module.masters[tagConfig.master];

      if (config.writeAllTheThings
        && (!master || master.writeAllTheThings !== false)
        && tagConfig.kind !== 'virtual'
        && tagConfig.kind !== 'setting')
      {
        lodash.merge(tagConfig, {
          kind: 'register',
          address: address,
          master: config.writeAllTheThings,
          writable: true
        });

        master = module.masters[config.writeAllTheThings];

        address += getRegisterQuantityFromType(tagConfig.type);
      }

      var tag = new Tag(app.broker, module, tagName, tagConfig);

      if (typeof master !== 'undefined')
      {
        master.tags.push(tag);
      }

      module.tags[tagName] = tag;

      if (module.values[tagName] === undefined)
      {
        module.values[tagName] = null;
      }
    });
  }

  /**
   * @private
   */
  function setUpReadTransactions()
  {
    Object.keys(module.masters).forEach(setUpMasterReadTransaction);
  }

  /**
   * @private
   * @param {string} masterName
   */
  function setUpMasterReadTransaction(masterName)
  {
    var master = module.masters[masterName];
    var tagsByUnit = groupTagsByUnitAndCode(master.tags);
    var transactions = [];

    Object.keys(tagsByUnit).forEach(function(unit)
    {
      var tagsByCode = tagsByUnit[unit];

      Object.keys(tagsByCode).forEach(function(code)
      {
        createReadTransactions(transactions, tagsByCode[code]);
      });
    });

    master.once('connected', function()
    {
      transactions.forEach(function(tInfo)
      {
        var request = {
          code: tInfo.functionCode,
          address: tInfo.startingAddress,
          quantity: tInfo.quantity
        };
        var unit = tInfo.unit;

        var transaction = master.execute({
          request: request,
          unit: unit,
          maxRetries: 0,
          interval: module.config.masters[masterName].interval
            || (25 + Math.round(Math.random() * 25))
        });

        transaction.on('complete', function(err, res)
        {
          master.emit('transaction complete', err, res);
        });

        transaction.on('error', function(err)
        {
          var code = err.code || err.name.replace('Error', '');

          if (module.config.ignoredErrors.indexOf(code) === -1)
          {
            app.broker.publish('modbus.error', {
              severity: 'debug',
              message: err.message,
              master: masterName,
              unit: unit,
              request: request
            });
          }
        });

        transaction.on('response', createResponseHandler(masterName, tInfo));
      });
    });
  }

  /**
   * @private
   * @param {Array.<Tag>} tags
   * @returns {object.<number, object.<number, Tag>>}
   */
  function groupTagsByUnitAndCode(tags)
  {
    var groupedTags = {};

    tags.forEach(function(tag)
    {
      if (!tag.isReadable())
      {
        return;
      }

      if (typeof groupedTags[tag.unit] === 'undefined')
      {
        groupedTags[tag.unit] = {};
      }

      if (!Array.isArray(groupedTags[tag.unit][tag.code]))
      {
        groupedTags[tag.unit][tag.code] = [];
      }

      groupedTags[tag.unit][tag.code].push(tag);
    });

    return groupedTags;
  }

  /**
   * @private
   * @param {Array.<object>} transactions
   * @param {Array.<Tag>} tags
   */
  function createReadTransactions(transactions, tags)
  {
    var tInfo;
    var lastAddress;

    var lastTagIndex = tags.length - 1;

    function adjustQuantity(tInfo, tag, i)
    {
      if (i === lastTagIndex)
      {
        tInfo.quantity += getRegisterQuantityFromType(tag.type) - 1;
      }
    }

    tags.sort(function(a, b)
    {
      return a.address - b.address;
    });

    tags.forEach(function(tag, i)
    {
      if (i === 0)
      {
        tInfo = createNewReadTransaction(tag);
        lastAddress = tag.address;

        adjustQuantity(tInfo, tag, i);

        transactions.push(tInfo);

        return;
      }

      var diff = tag.address - lastAddress;

      if (tInfo.quantity + diff > module.config.maxReadQuantity)
      {
        tInfo.quantity += getRegisterQuantityFromType(tags[i - 1].type) - 1;

        tInfo = createNewReadTransaction(tag);
        lastAddress = tag.address;

        adjustQuantity(tInfo, tag, i);

        transactions.push(tInfo);

        return;
      }

      tInfo.quantity += diff;

      adjustQuantity(tInfo, tag, i);

      tInfo.tags.push(tag.name);

      lastAddress = tag.address;
    });
  }

  /**
   * @private
   * @param {Tag} tag
   * @returns {object}
   */
  function createNewReadTransaction(tag)
  {
    return {
      functionCode: tag.code,
      startingAddress: tag.address,
      unit: tag.unit,
      quantity: 1,
      tags: [tag.name]
    };
  }

  /**
   * @private
   * @param {string} tagType
   * @returns {number}
   */
  function getRegisterQuantityFromType(tagType)
  {
    /*jshint -W015*/

    switch (tagType)
    {
      case 'double':
        return 4;

      case 'float':
      case 'uint32':
      case 'int32':
        return 2;

      default:
        return 1;
    }
  }

  /**
   * @private
   * @param {string} masterName
   * @param {object} tInfo
   * @returns {function}
   */
  function createResponseHandler(masterName, tInfo)
  {
    var bits = tInfo.functionCode === 0x01 || tInfo.functionCode === 0x02;

    return function(res)
    {
      if (res.isException())
      {
        app.broker.publish('modbus.exception', {
          severity: 'debug',
          master: masterName,
          unit: tInfo.unit,
          functionCode: res.getCode(),
          exceptionCode: res.getExceptionCode(),
          message: res.toString()
        });

        return;
      }

      if (res.getCount() < tInfo.quantity)
      {
        app.broker.publish('modbus.incompleteResponse', {
          severity: 'debug',
          master: masterName,
          unit: tInfo.unit,
          expectedQuantity: tInfo.quantity,
          actualQuantity: res.getCount()
        });

        return;
      }

      var data = bits ? res.getStates() : res.getValues();

      for (var i = 0, l = tInfo.tags.length; i < l; ++i)
      {
        var tag = module.tags[tInfo.tags[i]];
        var newValue = bits
          ? data[tag.address - tInfo.startingAddress]
          : readTypedValue(tInfo, tag, data);

        tag.setValue(newValue);
      }
    };
  }

  /**
   * @private
   * @param {object} tInfo
   * @param {object} tag
   * @param {Buffer} buffer
   * @returns {number|string}
   */
  function readTypedValue(tInfo, tag, buffer)
  {
    /*jshint -W015*/

    var offset = (tag.address - tInfo.startingAddress) * 2;

    switch (tag.type)
    {
      case 'double':
        return buffer.readDoubleBE(offset, true);

      case 'float':
        return buffer.readFloatBE(offset, true);

      case 'uint32':
        return buffer.readUInt32BE(offset, true);

      case 'int32':
        return buffer.readInt32BE(offset, true);

      case 'int16':
      case 'int8':
        return buffer.readInt16BE(offset, true);

      case 'bool':
        return buffer.readInt16BE(offset, true) === 0 ? 0 : 1;

      case 'string':
        return buffer.toString();

      default:
        return buffer.readUInt16BE(offset, true);
    }
  }

  /**
   * @private
   */
  function setUpSettingsTags()
  {
    module.config.settingsCollection().find().toArray(function(err, docs)
    {
      if (err)
      {
        module.error("Failed to read the setting tags: %s", err.message);
      }
      else
      {
        docs.forEach(function(doc)
        {
          var tag = module.tags[doc._id];

          if (lodash.isObject(tag))
          {
            tag.setValue(doc.value, doc.time);
          }
        });
      }
    });
  }
};
