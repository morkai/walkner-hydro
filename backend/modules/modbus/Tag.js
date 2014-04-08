// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

/*jshint maxparams:5*/

'use strict';

var deltaUtils = require('./deltaUtils');
var scaleFunctions = require('./scaleFunctions');

/**
 * @constructor
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {string} name
 * @param {object} config
 */
function Tag(broker, modbus, name, config)
{
  /**
   * @type {h5.pubsub.Broker}
   */
  this.broker = broker;

  /**
   * @type {object}
   */
  this.modbus = modbus;

  /**
   * @type {boolean}
   */
  this.broadcastable =
    modbus.config.broadcastFilter.indexOf(name.split('.')[0]) === -1;

  /**
   * @private
   * @type {Array.<number>|null}
   */
  this.bits = null;

  /**
   * @private
   * @type {number|null}
   */
  this.bitMask = null;

  /**
   * @type {string|null}
   */
  this.master = config.master;

  /**
   * @type {number}
   */
  this.address = config.address;

  /**
   * @type {string|null}
   */
  this.deltaAddress = null;

  /**
   * @type {string}
   */
  this.name = name;

  /**
   * @type {string}
   */
  this.description = config.description;

  /**
   * @type {string}
   */
  this.kind = typeof config.kind === 'string' ? config.kind : 'virtual';

  /**
   * @type {number}
   */
  this.code = typeof config.code === 'number' ? config.code : 0x03;

  if (this.kind === 'virtual')
  {
    this.setUpVirtualization();
  }
  else if (typeof this.address === 'string')
  {
    this.deltaAddress = this.address;
    this.code = deltaUtils.getFunctionCode(this.deltaAddress);
    this.address = deltaUtils.getStartingAddress(this.deltaAddress);
  }

  /**
   * @type {number}
   */
  this.type = typeof config.type === 'string'
    ? config.type
    : this.code === 0x03 ? 'uint16' : 'bool';

  /**
   * @type {number}
   */
  this.unit = typeof config.unit === 'number' ? config.unit : -1;

  /**
   * @type {boolean}
   */
  this.readable = !!config.readable;

  /**
   * @type {boolean}
   */
  this.writable = !!config.writable;

  /**
   * @type {number|null}
   */
  this.rawMin = numberOrNull(config.rawMin);

  /**
   * @type {number|null}
   */
  this.rawMax = numberOrNull(config.rawMax);

  /**
   * @type {string|null}
   */
  this.scaleUnit
    = typeof config.scaleUnit === 'string' ? config.scaleUnit : null;

  /**
   * @type {string|null}
   */
  this.scaleFunction = typeof config.scaleFunction === 'string'
    ? config.scaleFunction
    : null;

  /**
   * @type {number|null}
   */
  this.scaleMin = numberOrNull(config.scaleMin);

  /**
   * @type {number|null}
   */
  this.scaleMax = numberOrNull(config.scaleMax);

  /**
   * @private
   * @type {{rawValueToValue: function, valueToRawValue: function}}
   */
  this.scale = scaleFunctions.create(this);

  /**
   * @type {string|null}
   */
  this.archive = typeof config.archive === 'string' ? config.archive : null;

  /**
   * @type {number}
   */
  this.lastChangeTime = 0;

  /**
   * @type {*}
   */
  this.oldValue = null;
}

/**
 * @returns {object}
 */
Tag.prototype.toJSON = function()
{
  return {
    name: this.name,
    description: this.description,
    master: this.master,
    unit: this.unit,
    kind: this.kind,
    type: this.type,
    address: this.deltaAddress ? this.deltaAddress : this.address,
    readable: this.isReadable(),
    writable: this.isWritable(),
    rawMin: this.rawMin,
    rawMax: this.rawMax,
    scaleUnit: this.scaleUnit,
    scaleFunction: this.scaleFunction,
    scaleMin: this.scaleMin,
    scaleMax: this.scaleMax,
    archive: this.archive
  };
};

/**
 * @returns {boolean}
 */
Tag.prototype.isConnected = function()
{
  var master = this.modbus.masters[this.master];

  return master ? master.isConnected() : false;
};

/**
 * @returns {boolean}
 */
Tag.prototype.isReadable = function()
{
  return this.readable && this.address !== null;
};

/**
 * @returns {boolean}
 */
Tag.prototype.isWritable = function()
{
  return this.writable && (this.address !== null || this.kind === 'setting');
};

/**
 * @returns {*}
 */
Tag.prototype.getValue = function()
{
  return this.modbus.values[this.name];
};

/**
 * @param {*} newValue
 * @param {number} [lastChangeTime]
 * @returns {boolean}
 */
Tag.prototype.setValue = function(newValue, lastChangeTime)
{
  newValue = this.rawValueToValue(newValue);

  var oldValue = this.modbus.values[this.name];

  if (newValue === oldValue)
  {
    return false;
  }

  this.lastChangeTime = lastChangeTime || Date.now();
  this.oldValue = oldValue;

  this.modbus.values[this.name] = newValue;

  this.broker.publish('tagValueChanged.' + this.name, {
    tag: this,
    time: this.lastChangeTime,
    oldValue: this.oldValue,
    newValue: newValue
  });

  return true;
};

/**
 * @param {*} value
 * @param {function(Error)} done
 * @returns {object}
 */
Tag.prototype.writeValue = function(value, done)
{
  /*jshint -W015*/

  if (!this.isWritable())
  {
    return done(new Error('TAG_WRITE_NOT_WRITABLE'));
  }

  var delay = this.checkBeforeWrite(value);

  if (delay === -1)
  {
    return done(new Error('TAG_WRITE_ILLEGAL'));
  }

  if (delay > 0)
  {
    return setTimeout(this.writeValue.bind(this, value, done), delay);
  }

  switch (this.kind)
  {
    case 'output':
      return this.writeOutputValue(value, done);

    case 'register':
      return this.writeRegisterValue(value, done);

    case 'virtual':
      return this.writeVirtualValue(value, done);

    case 'setting':
      return this.writeSettingValue(value, done);

    default:
      return done(new Error('TAG_WRITE_UNSUPPORTED'));
  }
};

/**
 * @private
 * @param {*} value
 * @returns {number}
 */
Tag.prototype.checkBeforeWrite = function(value)
{
  var state = {
    allowWrite: true,
    writeDelay: 0,
    newValue: value
  };

  this.broker.publish('beforeWriteTagValue.' + this.name, state);

  return state.allowWrite ? state.writeDelay : -1;
};

/**
 * @private
 * @param {boolean} state
 * @param {function} done
 */
Tag.prototype.writeOutputValue = function(state, done)
{
  var master = this.modbus.masters[this.master];
  var tag = this;

  master.writeSingleCoil(
    this.address, !!state, {
      unit: this.unit,
      onComplete: function onWriteRegisterValueComplete(err, res)
      {
        tag.handleWriteResponse(this, err, res, !!state, done);
      }
    }
  );
};

/**
 * @private
 * @param {*} value
 * @param {function} done
 */
Tag.prototype.writeRegisterValue = function(value, done)
{
  var master = this.modbus.masters[this.master];
  var valueBuffer;

  try
  {
    valueBuffer = this.createValueBuffer(this.valueToRawValue(value));
  }
  catch (err)
  {
    return done(err);
  }

  var tag = this;

  master.writeMultipleRegisters(
    this.address, valueBuffer, {
      unit: this.unit,
      onComplete: function onWriteRegisterValueComplete(err, res)
      {
        tag.handleWriteResponse(this, err, res, value, done);
      }
    }
  );
};

/**
 * @private
 * @param {*} value
 * @param {function} done
 */
Tag.prototype.writeVirtualValue = function(value, done)
{
  if (this.bitMask === null)
  {
    return done(new Error('TAG_WRITE_NO_BIT_MASK'));
  }

  if (typeof this.address !== 'string')
  {
    return done(new Error('TAG_WRITE_NO_REFERENCE_TAG'));
  }

  var referenceTag = this.modbus.tags[this.address.split('&')[0]];

  if (!referenceTag)
  {
    return done(new Error('TAG_WRITE_UNKNOWN_REFERENCE_TAG'));
  }

  var rawValue = this.valueToRawValue(value) << this.bits[0];
  var referenceValue = (referenceTag.getValue() & (~this.bitMask)) | rawValue;

  referenceTag.writeValue(referenceValue, done);
};

/**
 * @private
 * @param {*} value
 * @param {function} done
 */
Tag.prototype.writeSettingValue = function(value, done)
{
  var selector = {_id: this.name};
  var doc = {$set: {value: value, time: Date.now()}};
  var options = {upsert: true, w: 1};
  var settingsCollection = this.modbus.config.settingsCollection();
  var tag = this;

  settingsCollection.update(selector, doc, options, function(err)
  {
    done(err);

    if (!err)
    {
      tag.setValue(value);
    }
  });
};

/**
 * @private
 * @param {h5.modbus.Transaction} transaction
 * @param {Error|null} err
 * @param {h5.modbus.Response} res
 * @param {*} value
 * @param {function} done
 */
Tag.prototype.handleWriteResponse = function(transaction, err, res, value, done)
{
  if (err)
  {
    if (transaction.shouldRetry())
    {
      return;
    }

    return done(err);
  }

  if (res.isException())
  {
    if (transaction.shouldRetry())
    {
      return;
    }

    return done(new Error(res.toString()));
  }

  done();

  if (!this.isReadable())
  {
    this.setValue(value);
  }
};

/**
 * @private
 * @param {*} value
 * @returns {Buffer}
 */
Tag.prototype.createValueBuffer = function(value)
{
  /*jshint -W015*/

  var valueBuffer;

  switch (this.type)
  {
    case 'double':
      valueBuffer = new Buffer(8);
      valueBuffer.writeDoubleBE(value, 0);
      break;

    case 'float':
      valueBuffer = new Buffer(4);
      valueBuffer.writeFloatBE(value, 0);
      break;

    case 'uint32':
      valueBuffer = new Buffer(4);
      valueBuffer.writeUInt32BE(Math.round(value), 0);
      break;

    case 'int32':
      valueBuffer = new Buffer(4);
      valueBuffer.writeInt32BE(Math.round(value), 0);
      break;

    case 'uint16':
    case 'uint8':
      valueBuffer = new Buffer(2);
      valueBuffer.writeUInt16BE(Math.round(value), 0);
      break;

    case 'int16':
    case 'int8':
      valueBuffer = new Buffer(2);
      valueBuffer.writeInt16BE(Math.round(value), 0);
      break;

    default:
      valueBuffer = new Buffer(2);
      valueBuffer.writeInt16BE(value ? 1 : 0, 0);
      break;
  }

  return valueBuffer;
};

/**
 * @private
 * @param {*} rawValue
 * @returns {*}
 */
Tag.prototype.rawValueToValue = function(rawValue)
{
  if (rawValue === null)
  {
    return null;
  }

  if (this.rawMin !== null && rawValue < this.rawMin)
  {
    return null;
  }

  if (this.rawMax !== null && rawValue > this.rawMax)
  {
    return null;
  }

  var value = this.scale.rawValueToValue(rawValue);

  if (this.type === 'bool')
  {
    return !!value;
  }

  return value;
};

/**
 * @private
 * @param {*} value
 * @returns {number}
 */
Tag.prototype.valueToRawValue = function(value)
{
  /*jshint -W015,-W065*/

  switch (this.type)
  {
    case 'double':
    case 'float':
      value = parseFloat(value);
      break;

    case 'bool':
      value = value ? true : false;
      break;

    case 'string':
      value = String(value);
      break;

    default:
      value = parseFloat(value);
      break;
  }

  var rawValue = this.scale.valueToRawValue(value);

  if (this.rawMin !== null && rawValue < this.rawMin)
  {
    return this.rawMin;
  }

  if (this.rawMax !== null && rawValue > this.rawMax)
  {
    return this.rawMax;
  }

  return rawValue;
};

/**
 * @private
 */
Tag.prototype.setUpVirtualization = function()
{
  if (typeof this.address !== 'string' || this.address.indexOf('.') === -1)
  {
    return;
  }

  var address = this.address.split('.');
  var referenceTag = address[0];

  if (typeof this.modbus.tags[referenceTag] === 'undefined')
  {
    throw new Error(
      "Invalid address for " + this.name + ". "
        + "Reference tag " + referenceTag + " does not exist."
    );
  }

  var bits = address[1]
    .split('-')
    .map(Number)
    .filter(function(value) { return !isNaN(value); });

  if (bits.length > 1 && bits[0] >= bits[1])
  {
    throw new Error(
      "Invalid address for " + this.name + ". "
        + "Start bit should be lower than the end bit."
    );
  }

  this.bits = bits.length === 1 ? [bits[0], bits[0]] : bits;
  this.bitMask = createBitMask(this.bits[0], this.bits[1]);

  var tag = this;
  var topic = 'tagValueChanged.' + referenceTag;

  this.broker.subscribe(topic, function(message)
  {
    if (typeof message.newValue === 'number')
    {
      tag.setValue((message.newValue & tag.bitMask) >> tag.bits[0]);
    }
  });
};

/**
 * @private
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function createBitMask(a, b)
{
  var mask = 0;

  for (var i = a; i <= b; ++i)
  {
    mask += 1 << i;
  }

  return mask;
}

/**
 * @param {*} value
 * @returns {number|null}
 */
function numberOrNull(value)
{
  value = parseFloat(value);

  if (isNaN(value))
  {
    return null;
  }

  return value;
}

module.exports = Tag;
