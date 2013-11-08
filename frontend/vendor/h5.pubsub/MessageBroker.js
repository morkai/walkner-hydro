define(function(require, exports, module) {var Subscriptions = require('./Subscriptions');
var Subscription = require('./Subscription');
var Sandbox = require('./Sandbox');

module.exports = MessageBroker;

/**
 * @name h5.pubsub.MessageBroker
 * @constructor
 * @implements {h5.pubsub.Broker}
 */
function MessageBroker()
{
  /**
   * @private
   * @type {h5.pubsub.Subscriptions}
   */
  this.subscriptions = new Subscriptions(this);

  /**
   * @private
   * @type {number}
   */
  this.nextSubscriptionId = 0;

  /**
   * @type {object}
   */
  this.listeners = {
    'subscribe': null,
    'cancel': null,
    'new topic': null,
    'empty topic': null,
    'message': null
  };
}

MessageBroker.prototype.destroy = function()
{
  this.subscriptions.destroy();

  this.listeners = null;
};

/**
 * @return {h5.pubsub.Sandbox}
 */
MessageBroker.prototype.sandbox = function()
{
  return new Sandbox(this);
};

/**
 * @param {string} topic
 * @param {*} [message]
 * @param {object} [meta]
 * @throws {Error} If the specified topic is invalid.
 */
MessageBroker.prototype.publish = function(topic, message, meta)
{
  if (typeof meta === 'undefined')
  {
    meta = {};
  }

  this.emit('message', topic, message, meta);

  this.subscriptions.send(topic, message, meta);

  return this;
};

/**
 * @param {string} topic
 * @param {function(string, *, object)} [onMessage]
 * @return {h5.pubsub.Subscription}
 * @throws {Error} If the specified topic is invalid.
 */
MessageBroker.prototype.subscribe = function(topic, onMessage)
{
  var subscription = new Subscription(this.getNextSubscriptionId(), topic);

  if (typeof onMessage === 'function')
  {
    subscription.on('message', onMessage);
  }

  this.subscriptions.add(subscription);

  this.emit('subscribe', subscription);

  return subscription;
};

/**
 * @param {string} topic
 * @return {h5.pubsub.MessageBroker}
 * @throws {Error} If the specified topic is invalid.
 */
MessageBroker.prototype.unsubscribe = function(topic)
{
  this.subscriptions.remove(topic);

  return this;
};

/**
 * @return {object.<string, number>}
 */
MessageBroker.prototype.count = function()
{
  var prefix = '';
  var result = {};

  this.subscriptions.count(prefix, result);

  return result;
};

/**
 * @param {string} event
 * @param {function} callback
 * @return {h5.pubsub.MessageBroker}
 * @throws {Error} If the specified event is unknown.
 */
MessageBroker.prototype.on = function(event, callback)
{
  var listeners = this.listeners[event];
  var listenersType = typeof listeners;

  if (listenersType === 'undefined')
  {
    throw new Error("Unknown event: " + event);
  }

  if (listeners === null)
  {
    this.listeners[event] = callback;
  }
  else if (listenersType === 'function')
  {
    this.listeners[event] = [listeners, callback];
  }
  else
  {
    this.listeners[event].push(callback);
  }

  return this;
};

/**
 * @param {string} event
 * @param {function} callback
 * @return {h5.pubsub.MessageBroker}
 * @throws {Error} If the specified event is unknown.
 */
MessageBroker.prototype.off = function(event, callback)
{
  var listeners = this.listeners[event];
  var listenersType = typeof listeners;

  if (listenersType === 'undefined')
  {
    throw new Error("Unknown event: " + event);
  }

  if (listenersType === 'function' && listeners === callback)
  {
    this.listeners[event] = null;
  }
  else if (listenersType === 'object' && listeners !== null)
  {
    var listenerIndex = -1;
    var listenersCount = listeners.length;

    for (var i = 0; i < listenersCount; ++i)
    {
      if (listeners[i] === callback)
      {
        listenerIndex = i;

        break;
      }
    }

    if (listenerIndex !== -1)
    {
      listeners.splice(listenerIndex, 1);

      if (listenersCount === 2)
      {
        this.listeners[event] = listeners[0];
      }
    }
  }

  return this;
};

/**
 * @param {string} event
 * @param {...*} args
 * @return {h5.pubsub.MessageBroker}
 * @throws {Error} If the specified event is unknown.
 */
MessageBroker.prototype.emit = function(event, args)
{
  var listeners = this.listeners[event];
  var listenersType = typeof listeners;

  if (listenersType === 'undefined')
  {
    throw new Error("Unknown event: " + event);
  }

  if (listeners === null)
  {
    return this;
  }

  var argCount = arguments.length;

  if (typeof listeners === 'function')
  {
    switch (argCount)
    {
      case 4:
        listeners(arguments[1], arguments[2], arguments[3]);
        break;

      case 3:
        listeners(arguments[1], arguments[2]);
        break;

      case 2:
        listeners(arguments[1]);
        break;

      default:
      {
        args = Array.prototype.slice.call(arguments);
        args.shift();

        listeners.apply(null, args);
      }
    }

    return this;
  }

  if (argCount > 4)
  {
    args = Array.prototype.slice.call(arguments);
    args.shift();
  }

  for (var i = 0, l = listeners.length; i < l; ++i)
  {
    var listener = listeners[i];

    switch (argCount)
    {
      case 4:
        listener(arguments[1], arguments[2], arguments[3]);
        break;

      case 3:
        listener(arguments[1], arguments[2]);
        break;

      case 2:
        listener(arguments[1]);
        break;

      default:
        listener.apply(null, args);
    }
  }

  return this;
};

/**
 * @private
 * @return {string}
 */
MessageBroker.prototype.getNextSubscriptionId = function()
{
  return (this.nextSubscriptionId++).toString(36);
};

});
