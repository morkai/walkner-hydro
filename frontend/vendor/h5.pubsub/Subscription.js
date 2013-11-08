define(function(require, exports, module) {
module.exports = Subscription;

/**
 * @name h5.pubsub.Subscription
 * @constructor
 * @param {string} id
 * @param {string} topic
 */
function Subscription(id, topic)
{
  /**
   * @private
   * @type {boolean}
   */
  this.cancelled = false;

  /**
   * @private
   * @type {string}
   */
  this.id = id;

  /**
   * @private
   * @type {string}
   */
  this.topic = topic;

  /**
   * @private
   * @type {object|function|null}
   */
  this.messageFilter = null;

  /**
   * @private
   * @type {number}
   */
  this.messageLimit = 0;

  /**
   * @private
   * @type {number}
   */
  this.messageCount = 0;

  /**
   * @private
   * @type {(function(*, string, string, object, h5.pubsub.Subscription): boolean)|null}
   */
  this.doFilter = null;

  /**
   * @private
   * @type {object.<string, function|Array.<function>>}
   */
  this.listeners = {
    'cancel': null,
    'message': null
  };
}

/**
 * @param {*} filter
 * @return {function(*, string, string, object, h5.pubsub.Subscription): boolean}
 * @throws {Error} If the implementation was not supplied by the user.
 */
Subscription.compileFilter = function(filter)
{
  throw new Error('Subscription.compileFilter() is not implemented!');
};

/**
 * @return {object}
 */
Subscription.prototype.toJSON = function()
{
  var filter = this.getFilter();

  if (typeof filter === 'function')
  {
    filter = filter.toString();
  }

  return {
    id: this.getId(),
    topic: this.getTopic(),
    limit: this.getLimit(),
    filter: filter
  };
};

/**
 * @return {*}
 */
Subscription.prototype.getId = function()
{
  return this.id;
};

/**
 * @return {string}
 */
Subscription.prototype.getTopic = function()
{
  return this.topic;
};

/**
 * @return {object|(function(*, string, string, object, h5.pubsub.Subscription): boolean)|null}
 */
Subscription.prototype.getFilter = function()
{
  return this.messageFilter;
};

/**
 * @param {object|(function(*, string, string, object, h5.pubsub.Subscription): boolean)} filter
 * @return {h5.pubsub.Subscription}
 */
Subscription.prototype.setFilter = function(filter)
{
  this.messageFilter = filter;

  if (typeof filter === 'function')
  {
    this.doFilter = filter;
  }
  else
  {
    this.doFilter = Subscription.compileFilter(filter);

    if (typeof this.doFilter !== 'function')
    {
      throw new Error('Subscription.compileFilter() must return a function.');
    }
  }

  return this;
};

/**
 * @return {number}
 */
Subscription.prototype.getLimit = function()
{
  return this.messageLimit;
};

/**
 * @param {number} limit
 * @return {h5.pubsub.Subscription}
 * @throws {Error} If the specified limit is less than 1.
 */
Subscription.prototype.setLimit = function(limit)
{
  if (limit < 1)
  {
    throw new Error("Subscription limit must be greater than 0.");
  }

  this.messageLimit = limit;

  return this;
};

/**
 * @return {number}
 */
Subscription.prototype.getMessageCount = function()
{
  return this.messageCount;
};

/**
 * @param {string} event
 * @param {function} callback
 * @return {h5.pubsub.Subscription}
 * @throws {Error} If the specified event is unknown.
 */
Subscription.prototype.on = function(event, callback)
{
  if (this.cancelled)
  {
    return this;
  }

  var listeners = this.listeners[event];
  var listenersType = typeof listeners;

  if (listenersType === 'undefined')
  {
    throw new Error("Unknown event: " + event);
  }

  if (listenersType === 'function')
  {
    this.listeners[event] = [listeners, callback];
  }
  else if (listeners === null)
  {
    this.listeners[event] = callback;
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
 * @return {h5.pubsub.Subscription}
 * @throws {Error} If the specified event is unknown.
 */
Subscription.prototype.off = function(event, callback)
{
  if (this.cancelled)
  {
    return this;
  }

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

Subscription.prototype.cancel = function()
{
  if (this.cancelled)
  {
    return;
  }

  this.cancelled = true;

  this.emit('cancel', this);

  this.listeners = null;
  this.doFilter = null;
};

/**
 * @param {string} topic
 * @param {*} message
 * @param {*} meta
 */
Subscription.prototype.send = function(topic, message, meta)
{
  if (this.cancelled
    || (this.doFilter !== null && !this.doFilter(message, topic, meta, this)))
  {
    return;
  }

  ++this.messageCount;

  this.emit('message', message, topic, meta, this);

  if (this.messageCount === this.messageLimit)
  {
    this.cancel();
  }
};

/**
 * @private
 * @param {string} event
 */
Subscription.prototype.emit = function(event)
{
  var listeners = this.listeners[event];

  if (listeners === null)
  {
    return;
  }

  var argCount = arguments.length;

  if (typeof listeners === 'function')
  {
    if (argCount === 5)
    {
      listeners(arguments[1], arguments[2], arguments[3], arguments[4]);
    }
    else
    {
      listeners(arguments[1]);
    }

    return;
  }

  for (var i = 0, l = listeners.length; i < l; ++i)
  {
    if (argCount === 5)
    {
      listeners[i](arguments[1], arguments[2], arguments[3], arguments[4]);
    }
    else
    {
      listeners[i](arguments[1]);
    }
  }
};

});
