// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

/*jshint maxparams:5*/

'use strict';

var lodash = require('lodash');
var Lock = require('./Lock');

/**
 * @constructor
 * @param {h5.pubsub.Broker} broker
 * @param {object} modbus
 * @param {object} program
 * @param {string} tagPrefix
 * @param {number} index
 */
function ControlUnit(broker, modbus, program, tagPrefix, index)
{
  /**
   * @protected
   * @type {h5.pubsub.Sandbox}
   */
  this.broker = broker.sandbox();

  /**
   * @protected
   * @type {object}
   */
  this.modbus = modbus;

  /**
   * @protected
   * @type {object}
   */
  this.program = program;

  /**
   * @private
   * @type {number}
   */
  this.index = index;

  /**
   * @private
   * @type {string}
   */
  this.tagPrefix = index > 0 ? tagPrefix + '.' + index : tagPrefix;

  /**
   * @private
   * @type {object.<string, Lock>}
   */
  this.locks = {};
}

/**
 * @returns {number}
 */
ControlUnit.prototype.getIndex = function()
{
  return this.index;
};

/**
 * @protected
 * @param {string} name
 * @returns {string}
 */
ControlUnit.prototype.getTagName = function(name)
{
  if (name.charAt(0) === '.')
  {
    return this.tagPrefix + name;
  }
  else
  {
    return name;
  }
};

/**
 * @protected
 * @param {string} tagName
 * @returns {string}
 */
ControlUnit.prototype.getTagValue = function(tagName)
{
  return this.modbus.values[this.getTagName(tagName)];
};

/**
 * @protected
 * @param {string} tagName
 * @returns {string}
 */
ControlUnit.prototype.getLastTagChangeTime = function(tagName)
{
  var tag = this.modbus.tags[this.getTagName(tagName)];

  if (lodash.isUndefined(tag))
  {
    return 0;
  }

  return tag.lastChangeTime;
};

/**
 * @protected
 * @param {string} tagName
 * @param {*} value
 * @param {function(Error|null, boolean)} [done]
 */
ControlUnit.prototype.setTagValue = function(tagName, value, done)
{
  if (!lodash.isFunction(done))
  {
    done = function() {};
  }

  tagName = this.getTagName(tagName);

  var tag = this.modbus.tags[tagName];

  if (!lodash.isObject(tag))
  {
    return done(new Error('UNKNOWN_TAG'));
  }

  if (tag.getValue() === value)
  {
    return done(null, true);
  }

  tag.writeValue(value, done);
};

/**
 * @protected
 * @param {string} tagName
 * @param {*} value
 * @param {number} [waitTime]
 * @param {function(Error|null, boolean)} done
 */
ControlUnit.prototype.ackTagValue = function(tagName, value, waitTime, done)
{
  if (arguments.length === 3)
  {
    done = waitTime;
    waitTime = 2000;
  }

  var tag = this.modbus.tags[this.getTagName(tagName)];

  if (lodash.isUndefined(tag) || tag.getValue() === value)
  {
    return done(null, false);
  }

  var sub;
  var timer;

  sub = this.broker.subscribe('tagValueChanged.' + tag.name)
    .on('message', function(message)
    {
      if (message.newValue === value)
      {
        sub.cancel();

        clearTimeout(timer);

        done(null, false);
      }
    });

  timer = setTimeout(
    function()
    {
      sub.cancel();

      done(new Error('ACK_TIMEOUT'), false);
    },
    waitTime || 2000
  );
};

/**
 * @protected
 * @param {string|Array.<string>} tagNames
 * @param {string} cb
 */
ControlUnit.prototype.watch = function(tagNames, cb)
{
  cb = this.bindExec(cb);

  if (!lodash.isArray(tagNames))
  {
    tagNames = [tagNames];
  }

  var controlUnit = this;

  lodash.each(tagNames, function(tagName)
  {
    controlUnit.broker.subscribe(
      'tagValueChanged.' + controlUnit.getTagName(tagName), cb
    );
  });

  process.nextTick(cb);
};

/**
 * @protected
 * @param {string} cb
 * @returns {function}
 */
ControlUnit.prototype.bindExec = function(cb)
{
  return this.program.exec.bind(
    null, this[cb].bind(this), this.tagPrefix + '~' + cb
  );
};

/**
 * @protected
 * @param {string} id
 * @returns {Lock}
 */
ControlUnit.prototype.lock = function(id)
{
  if (lodash.isUndefined(this.locks[id]))
  {
    this.locks[id] = new Lock();
  }

  return this.locks[id];
};

/**
 * @protected
 */
ControlUnit.prototype.debug = function()
{
  arguments[0] = '[' + this.tagPrefix + '] ' + arguments[0];

  this.program.debug.apply(null, arguments);
};

/**
 * @protected
 */
ControlUnit.prototype.warn = function()
{
  arguments[0] = '[' + this.tagPrefix + '] ' + arguments[0];

  this.program.warn.apply(null, arguments);
};

/**
 * @protected
 */
ControlUnit.prototype.error = function()
{
  arguments[0] = '[' + this.tagPrefix + '] ' + arguments[0];

  this.program.error.apply(null, arguments);
};

module.exports = ControlUnit;
