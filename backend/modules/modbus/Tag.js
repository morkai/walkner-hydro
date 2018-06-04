// Part of <https://miracle.systems/p/walkner-maxos> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const deepEqual = require('deep-equal');
const deltaUtils = require('./deltaUtils');
const scaleFunctions = require('./scaleFunctions');

/**
 * @constructor
 * @param {Broker} broker
 * @param {Object} modbus
 * @param {string} name
 * @param {Object} config
 */
function Tag(broker, modbus, name, config)
{
  /**
   * @type {Broker}
   */
  this.broker = broker;

  /**
   * @type {Object}
   */
  this.modbus = modbus;

  /**
   * @type {boolean}
   */
  this.broadcastable = !_.includes(modbus.config.broadcastFilter, name.split('.')[0]);

  /**
   * @private
   * @type {?Array<number>}
   */
  this.bits = null;

  /**
   * @private
   * @type {?number}
   */
  this.bitMask = null;

  /**
   * @type {?string}
   */
  this.master = config.master;

  /**
   * @type {number}
   */
  this.address = config.address;

  /**
   * @type {?string}
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

  if (typeof config.code === 'number')
  {
    this.code = config.code;
  }
  else
  {
    this.code = deltaUtils.getFunctionCode(config.kind);

    if (this.code === -1)
    {
      this.code = 0x03;
    }
  }

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
   * @type {?number}
   */
  this.rawMin = numberOrNull(config.rawMin);

  /**
   * @type {?number}
   */
  this.rawMax = numberOrNull(config.rawMax);

  /**
   * @type {?string}
   */
  this.scaleUnit = typeof config.scaleUnit === 'string' ? config.scaleUnit : null;

  /**
   * @type {?string}
   */
  this.scaleFunction = typeof config.scaleFunction === 'string' ? config.scaleFunction : null;

  /**
   * @type {?number}
   */
  this.scaleMin = numberOrNull(config.scaleMin);

  /**
   * @type {?number}
   */
  this.scaleMax = numberOrNull(config.scaleMax);

  /**
   * @private
   * @type {{rawValueToValue: function, valueToRawValue: function}}
   */
  this.scale = scaleFunctions.create(this);

  /**
   * @type {?string}
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
 * @returns {Object}
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
    archive: this.archive,
    lastChangeTime: this.lastChangeTime,
    value: this.getValue()
  };
};

/**
 * @returns {boolean}
 */
Tag.prototype.isConnected = function()
{
  const master = this.modbus.masters[this.master];

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
  return this.writable && (this.address !== null || this.kind === 'setting' || this.kind === 'memory');
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

  const oldValue = this.modbus.values[this.name];

  if (deepEqual(newValue, oldValue))
  {
    return false;
  }

  this.lastChangeTime = lastChangeTime || Date.now();
  this.oldValue = oldValue;

  this.modbus.values[this.name] = newValue;

  this.broker.publish(`tagValueChanged.${this.name}`, {
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
 * @returns {Object}
 */
Tag.prototype.writeValue = function(value, done)
{
  if (!this.isWritable())
  {
    return done(new Error('TAG_WRITE_NOT_WRITABLE'));
  }

  const delay = this.checkBeforeWrite(value);

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

    case 'memory':
      return this.writeMemoryValue(value, done);

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
  const state = {
    tag: this,
    allowWrite: true,
    writeDelay: 0,
    newValue: value
  };

  this.broker.publish(`beforeWriteTagValue.${this.name}`, state);

  return state.allowWrite ? state.writeDelay : -1;
};

/**
 * @private
 * @param {boolean} state
 * @param {function} done
 */
Tag.prototype.writeOutputValue = function(state, done)
{
  const master = this.modbus.masters[this.master];
  const transaction = master.writeSingleCoil(this.address, !!state, {unit: this.unit});

  transaction.once('complete', (err, res) => this.handleWriteResponse(transaction, err, res, !!state, done));
};

/**
 * @private
 * @param {*} value
 * @param {function} done
 */
Tag.prototype.writeRegisterValue = function(value, done)
{
  const master = this.modbus.masters[this.master];
  let valueBuffer;

  try
  {
    valueBuffer = this.createValueBuffer(this.valueToRawValue(value));
  }
  catch (err)
  {
    done(err);

    return;
  }

  const transaction = master.writeMultipleRegisters(this.address, valueBuffer, {unit: this.unit});

  transaction.once('complete', (err, res) => this.handleWriteResponse(transaction, err, res, value, done));
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
    done(new Error('TAG_WRITE_NO_BIT_MASK'));

    return;
  }

  if (typeof this.address !== 'string')
  {
    done(new Error('TAG_WRITE_NO_REFERENCE_TAG'));

    return;
  }

  const referenceTag = this.modbus.tags[this.address.split('&')[0]];

  if (!referenceTag)
  {
    done(new Error('TAG_WRITE_UNKNOWN_REFERENCE_TAG'));

    return;
  }

  const rawValue = this.valueToRawValue(value) << this.bits[0];
  const referenceValue = (referenceTag.getValue() & (~this.bitMask)) | rawValue;

  referenceTag.writeValue(referenceValue, done);
};

/**
 * @private
 * @param {*} value
 * @param {function} done
 */
Tag.prototype.writeSettingValue = function(value, done)
{
  const selector = {_id: this.name};
  const doc = {$set: {value: this.valueToRawValue(value), time: Date.now()}};
  const options = {upsert: true, w: 1};
  const settingsCollection = this.modbus.config.settingsCollection();

  settingsCollection.update(selector, doc, options, (err) =>
  {
    done(err);

    if (!err)
    {
      this.setValue(doc.$set.value);
    }
  });
};

/**
 * @private
 * @param {*} value
 * @param {function} done
 */
Tag.prototype.writeMemoryValue = function(value, done)
{
  this.setValue(this.valueToRawValue(value));

  setImmediate(done);
};

/**
 * @private
 * @param {Transaction} transaction
 * @param {Error|null} err
 * @param {Response} res
 * @param {*} value
 * @param {function} done
 */
Tag.prototype.handleWriteResponse = function(transaction, err, res, value, done)
{
  if (err)
  {
    done(err);

    return;
  }

  if (res.isException())
  {
    done(new Error(res.toString()));

    return;
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
  let valueBuffer;

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
  if (value === undefined)
  {
    value = null;
  }

  switch (this.type)
  {
    case 'double':
    case 'float':
      value = parseFloat(value);
      break;

    case 'bool':
      value = !!value;
      break;

    case 'string':
    case 'text':
      value = String(value);
      break;

    case 'object':
      try
      {
        if (typeof value === 'string')
        {
          value = JSON.parse(value);
        }
        else if (!_.isPlainObject(value))
        {
          value = null;
        }
      }
      catch (err)
      {
        value = null;
      }
      break;

    default:
      value = parseFloat(value);
      break;
  }

  const rawValue = this.scale.valueToRawValue(value);

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

  const address = this.address.split('&');
  const referenceTag = address[0];

  if (typeof this.modbus.tags[referenceTag] === 'undefined')
  {
    throw new Error(`Invalid address for [${this.name}]. Reference tag [${referenceTag}] does not exist.`);
  }

  const bits = address[1]
    .split('-')
    .map(v => +v)
    .filter(v => !isNaN(v));

  if (bits.length > 1 && bits[0] >= bits[1])
  {
    throw new Error(`Invalid address for [${this.name}]. Start bit should be lower than the end bit.`);
  }

  this.bits = bits.length === 1 ? [bits[0], bits[0]] : bits;
  this.bitMask = createBitMask(this.bits[0], this.bits[1]);

  const topic = `tagValueChanged.${referenceTag}`;

  this.broker.subscribe(topic, (message) =>
  {
    if (message.newValue === null)
    {
      this.setValue(null);
    }
    else if (typeof message.newValue === 'number')
    {
      this.setValue((message.newValue & this.bitMask) >> this.bits[0]);
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
  let mask = 0;

  for (var i = a; i <= b; ++i)
  {
    mask += 1 << i;
  }

  return mask;
}

/**
 * @param {*} value
 * @returns {?number}
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
