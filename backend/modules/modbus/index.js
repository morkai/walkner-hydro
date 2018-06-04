// Part of <https://miracle.systems/p/walkner-maxos> licensed under <CC BY-NC-SA 4.0>

'use strict';

const fs = require('fs');
const _ = require('lodash');
const csv = require('csv');
const deepEqual = require('deep-equal');
const modbus = require('h5.modbus');
const Tag = require('./Tag');

exports.DEFAULT_CONFIG = {
  messengerServerId: 'messenger/server',
  programId: 'program',
  settingsCollection: function(app)
  {
    return app.mongodb.db.collection('tags.settings');
  },
  broadcastDelay: 100,
  broadcastFilter: [],
  writeAllTheThings: null,
  maxReadQuantity: 100,
  ignoredErrors: [],
  controlMasters: [],
  masters: {},
  tagsFile: null,
  tags: {},
  ignoreRe: null,
  resetTagsDelay: 1337
};

exports.start = function startModbusModule(app, module, done)
{
  module.config.settingsCollection = module.config.settingsCollection.bind(null, app);

  module.masters = {};
  module.tags = {};
  module.values = {};
  module.getTagValue = function(tagName)
  {
    return module.values[tagName];
  };
  module.setTagValue = function(tagName, newValue, done)
  {
    if (!done)
    {
      done = () => {};
    }

    if (module.config.ignoreRe && module.config.ignoreRe.test(tagName))
    {
      module.debug(`Tried to set ignored tag: ${tagName}`);

      return done();
    }

    const tag = module.tags[tagName];

    if (typeof tag === 'undefined')
    {
      module.debug(`Tried to set unknown tag: ${tagName}`);

      return done(Object.assign(new Error('UNKNOWN_TAG'), {tagName}));
    }

    if (deepEqual(newValue, tag.getValue()))
    {
      return done();
    }

    tag.writeValue(newValue, done);
  };

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
    setUpSettingsTags();

    require('./virtuals')(app, module);
    require('./safeGuards')(app, module);

    done();
  }

  /**
   * @private
   */
  function setUpServerMessages()
  {
    const messengerServer = app[module.config.messengerServerId];

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
    const messengerServer = app[module.config.messengerServerId];
    let pendingChanges = null;

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
          app.broker.publish('tagValuesChanged', pendingChanges);

          messengerServer.broadcast('modbus.tagValuesChanged', pendingChanges);

          pendingChanges = null;
        });
      }

      pendingChanges[message.tag.name] = message.newValue;
    });
  }

  /**
   * @private
   * @param {Object} req
   * @param {function} reply
   */
  function handleSetTagValueMessage(req, reply)
  {
    module.setTagValue(req.name, req.value, reply);
  }

  /**
   * @private
   * @param {string} csvPath
   * @param {Object} tags
   * @param {function} done
   */
  function importTagsCsv(csvPath, tags, done)
  {
    let tagsCsv;

    try
    {
      tagsCsv = fs.readFileSync(csvPath, 'utf8');
    }
    catch (err)
    {
      done();

      return;
    }

    const csvOptions = {
      delimiter: ',',
      rowDelimiter: '\n',
      quote: '"',
      trim: true,
      columns: true
    };
    const csvReader = csv.parse(tagsCsv, csvOptions);
    const complete = _.once(done);

    csvReader.on('error', complete);
    csvReader.on('finish', complete);
    csvReader.on('readable', () =>
    {
      let record;

      while (record = csvReader.read()) // eslint-disable-line no-cond-assign
      {
        if (_.isEmpty(record.name) || tags[record.name])
        {
          continue;
        }

        _.forEach(record, (value, key) => // eslint-disable-line no-loop-func
        {
          if (/^[A-Z]/.test(key))
          {
            delete record[key];
          }
          else if (value === '-' || value === '?')
          {
            record[key] = null;
          }
          else if (/^[0-9]+(\.[0-9]+)?$/.test(value))
          {
            record[key] = parseFloat(value);
          }
        });

        tags[record.name] = record;
      }
    });
  }

  /**
   * @private
   */
  function setUpMasters()
  {
    Object.keys(module.config.masters).forEach(createMaster);
  }

  function createMaster(masterName)
  {
    const config = module.config;
    const master = modbus.createMaster(config.masters[masterName]);

    master.tags = [];

    master.on('error', function(err)
    {
      if (config.ignoredErrors.indexOf(err.code) === -1)
      {
        app.broker.publish('modbus.error', {
          severity: 'debug',
          master: masterName,
          unit: -1,
          message: err.stack,
          code: err.code
        });
      }
    });

    const statusTagName = `masters.${masterName}`;
    let wasConnected = false;
    let resetTagsTimer = null;

    master.on('transaction complete', function(err)
    {
      if (!wasConnected && !err)
      {
        module.debug(`Master really connected: ${masterName}`);

        wasConnected = true;

        module.tags[statusTagName].setValue(wasConnected);

        if (resetTagsTimer !== null)
        {
          clearTimeout(resetTagsTimer);
          resetTagsTimer = null;
        }
      }
    });

    master.on('open', function()
    {
      module.debug(`Master maybe connected: ${masterName}`);
    });

    master.on('close', function()
    {
      module.debug(`Master disconnected: ${masterName}`);

      wasConnected = false;

      module.tags[statusTagName].setValue(wasConnected);

      if (resetTagsTimer !== null)
      {
        return;
      }

      resetTagsTimer = app.timeout(module.config.resetTagsDelay || 1337, function()
      {
        resetTagsTimer = null;

        _.forEach(master.tags, tag => { tag.setValue(null); });
      });
    });

    module.masters[masterName] = master;
  }

  /**
   * @private
   */
  function setUpTags()
  {
    const config = module.config;

    _.forEach(Object.keys(module.masters), function addStatusTag(masterName)
    {
      const statusTagName = `masters.${masterName}`;
      let statusTag = config.tags[statusTagName];

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

    let address = 0;

    _.forEach(config.tags, function setUpTag(tagConfig, tagName)
    {
      let master = module.masters[tagConfig.master];

      if (config.writeAllTheThings
        && (!master || master.writeAllTheThings !== false)
        && tagConfig.kind !== 'virtual'
        && tagConfig.kind !== 'setting'
        && tagConfig.kind !== 'memory')
      {
        _.assign(tagConfig, {
          kind: 'register',
          address: address,
          master: config.writeAllTheThings,
          writable: true
        });

        master = module.masters[config.writeAllTheThings];

        address += getRegisterQuantityFromType(tagConfig.type);
      }

      const tag = new Tag(app.broker, module, tagName, tagConfig);

      if (master)
      {
        master.tags.push(tag);
      }

      module.tags[tagName] = tag;

      if (module.values[tagName] == null)
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
    const master = module.masters[masterName];
    const tagsByUnit = groupTagsByUnitAndCode(master.tags);
    const transactions = [];

    _.forEach(tagsByUnit, function(tagsByCode)
    {
      _.forEach(tagsByCode, function(tags)
      {
        createReadTransactions(transactions, tags);
      });
    });

    master.once('open', function()
    {
      _.forEach(transactions, function(tInfo)
      {
        const request = {
          functionCode: tInfo.functionCode,
          startingAddress: tInfo.startingAddress,
          quantity: tInfo.quantity
        };
        const unit = tInfo.unit;
        const transaction = master.execute({
          request: request,
          unit: unit,
          maxRetries: 0,
          interval: module.config.masters[masterName].interval || (25 + Math.round(Math.random() * 25))
        });

        transaction.on('request', function()
        {
          this.startTime = Date.now();
        });

        transaction.on('complete', function(err, res)
        {
          master.emit('transaction complete', err, res);
        });

        transaction.on('error', function(err)
        {
          const code = (err.code || err.name).replace('Error', '');

          if (module.config.ignoredErrors.indexOf(code) === -1)
          {
            app.broker.publish('modbus.error', {
              severity: 'debug',
              message: err.stack,
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
   * @param {Array<Tag>} tags
   * @returns {Object<number, Object<number, Tag>>}
   */
  function groupTagsByUnitAndCode(tags)
  {
    const groupedTags = {};

    _.forEach(tags, function(tag)
    {
      if (!tag.isReadable())
      {
        return;
      }

      if (groupedTags[tag.unit] == null)
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
   * @param {Array<Object>} transactions
   * @param {Array<Tag>} tags
   */
  function createReadTransactions(transactions, tags)
  {
    const lastTagIndex = tags.length - 1;
    let tInfo;
    let lastAddress;

    function adjustQuantity(tInfo, tag, i)
    {
      if (i === lastTagIndex)
      {
        tInfo.quantity += getRegisterQuantityFromType(tag.type) - 1;
      }
    }

    tags.sort((a, b) => a.address - b.address);

    _.forEach(tags, function(tag, i)
    {
      if (i === 0)
      {
        tInfo = createNewReadTransaction(tag);
        lastAddress = tag.address;

        adjustQuantity(tInfo, tag, i);

        transactions.push(tInfo);

        return;
      }

      const addressDiff = tag.address - lastAddress;

      if (tInfo.quantity + addressDiff > getMaxReadQuantity(tag.master))
      {
        tInfo.quantity += getRegisterQuantityFromType(tags[i - 1].type) - 1;

        tInfo = createNewReadTransaction(tag);
        lastAddress = tag.address;

        adjustQuantity(tInfo, tag, i);

        transactions.push(tInfo);

        return;
      }

      tInfo.quantity += addressDiff;

      adjustQuantity(tInfo, tag, i);

      tInfo.tags.push(tag.name);

      lastAddress = tag.address;
    });
  }

  function getMaxReadQuantity(masterName)
  {
    const master = module.config.masters[masterName];

    return master && master.maxReadQuantity || module.config.maxReadQuantity;
  }

  /**
   * @private
   * @param {Tag} tag
   * @returns {Object}
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
   * @param {Object} tInfo
   * @returns {function}
   */
  function createResponseHandler(masterName, tInfo)
  {
    const bits = tInfo.functionCode === modbus.FunctionCode.ReadDiscreteInputs
      || tInfo.functionCode === modbus.FunctionCode.ReadCoils;

    return function(res)
    {
      if (res.isException())
      {
        if (res.exceptionCode === modbus.ExceptionCode.GatewayTargetDeviceFailedToRespond)
        {
          return nullifyTags(tInfo.tags);
        }

        app.broker.publish('modbus.exception', {
          severity: 'debug',
          master: masterName,
          unit: tInfo.unit,
          functionCode: res.functionCode,
          exceptionCode: res.exceptionCode,
          message: res.toString()
        });

        return;
      }

      if (res.quantity < tInfo.quantity)
      {
        app.broker.publish('modbus.incompleteResponse', {
          severity: 'debug',
          master: masterName,
          unit: tInfo.unit,
          expectedQuantity: tInfo.quantity,
          actualQuantity: res.quantity
        });

        return;
      }

      const data = bits ? res.states : res.data;

      for (let i = 0, l = tInfo.tags.length; i < l; ++i)
      {
        const tag = module.tags[tInfo.tags[i]];
        const newValue = bits
          ? data[tag.address - tInfo.startingAddress]
          : readTypedValue(tInfo, tag, data);

        tag.setValue(newValue);
      }
    };
  }

  /**
   * @private
   * @param {Array<string>} tagNames
   */
  function nullifyTags(tagNames)
  {
    _.forEach(tagNames, function(tagName)
    {
      const tag = module.tags[tagName];

      if (tag)
      {
        tag.setValue(null);
      }
    });
  }

  /**
   * @private
   * @param {Object} tInfo
   * @param {Object} tag
   * @param {Buffer} buffer
   * @returns {(number|string)}
   */
  function readTypedValue(tInfo, tag, buffer)
  {
    const offset = (tag.address - tInfo.startingAddress) * 2;

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
        return module.error(`Failed to read the setting tags: ${err.message}`);
      }

      const now = Date.now();

      _.forEach(docs, function(doc)
      {
        const tag = module.tags[doc._id];

        if (tag && tag.kind === 'setting')
        {
          tag.setValue(doc.value, now);
        }
      });
    });
  }
};
