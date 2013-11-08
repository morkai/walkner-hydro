define([
  'underscore'
], function(
  _
) {
  'use strict';

  /**
   * @name app.core.SocketSandbox
   * @constructor
   * @param {app.core.Socket|app.core.SocketSandbox} socket
   */
  function SocketSandbox(socket)
  {
    /**
     * @private
     * @type {app.core.Socket|app.core.SocketSandbox}
     */
    this.socket = socket;

    /**
     * @private
     * @type {object}
     */
    this.listeners = {
      destroy: []
    };

    if (socket instanceof SocketSandbox)
    {
      var me = this;

      this.socket.on('destroy', function()
      {
        me.destroy();
      });
    }
  }

  SocketSandbox.prototype.destroy = function()
  {
    var allListeners = this.listeners;
    var destroyListeners = allListeners.destroy;

    if (_.isArray(destroyListeners))
    {
      for (var i = 0, l = destroyListeners.length; i < l; ++i)
      {
        destroyListeners[i].call(this);
      }
    }

    delete this.listeners.destroy;

    var eventNames = Object.keys(allListeners);

    for (var j = 0, m = eventNames.length; j < m; ++j)
    {
      var eventName = eventNames[j];
      var listeners = allListeners[eventName];

      for (var k = 0, n = listeners.length; k < n; ++k)
      {
        this.socket.off(eventName, listeners[k]);
      }
    }

    this.listeners = null;
    this.socket = null;
  };

  /**
   * @returns {app.core.SocketSandbox}
   */
  SocketSandbox.prototype.sandbox = function()
  {
    return new SocketSandbox(this);
  };

  /**
   * @returns {boolean}
   */
  SocketSandbox.prototype.isConnected = function()
  {
    return this.socket.isConnected();
  };

  /**
   * @param {string} eventName
   * @param {function} cb
   * @returns {app.core.SocketSandbox}
   */
  SocketSandbox.prototype.on = function(eventName, cb)
  {
    var listeners = this.listeners[eventName];

    if (_.isUndefined(listeners))
    {
      listeners = this.listeners[eventName] = [];
    }

    listeners.push(cb);

    if (eventName !== 'destroy')
    {
      this.socket.on(eventName, cb);
    }

    return this;
  };

  /**
   * @param {string} eventName
   * @param {function} [cb]
   * @returns {app.core.SocketSandbox}
   */
  SocketSandbox.prototype.off = function(eventName, cb)
  {
    var listeners = this.listeners[eventName];

    if (_.isUndefined(listeners))
    {
      return this;
    }

    if (_.isUndefined(cb))
    {
      delete this.listeners[eventName];
    }
    else
    {
      var pos = _.indexOf(listeners, cb);

      if (pos === -1)
      {
        return this;
      }

      listeners.splice(pos, 1);

      if (listeners.length === 0)
      {
        delete this.listeners[eventName];
      }
    }

    if (eventName !== 'destroy')
    {
      this.socket.off(eventName, cb);
    }

    return this;
  };

  /**
   * @param {string} eventName
   * @param {...*} argN
   * @returns {app.core.SocketSandbox}
   */
  SocketSandbox.prototype.emit = function()
  {
    var args = Array.prototype.slice.call(arguments);
    var lastArgPos = args.length - 1;

    args[lastArgPos] = this.wrapCallback(args[lastArgPos]);

    this.socket.emit.apply(this.socket, args);

    return this;
  };

  /**
   * @param {*} data
   * @param {function} [cb]
   * @returns {app.core.SocketSandbox}
   */
  SocketSandbox.prototype.send = function(data, cb)
  {
    this.socket.send(data, this.wrapCallback(cb));

    return this;
  };

  /**
   * @private
   * @param {*} cb
   * @returns {*}
   */
  SocketSandbox.prototype.wrapCallback = function(cb)
  {
    if (!_.isFunction(cb))
    {
      return cb;
    }

    var socketSandbox = this;

    return function wrappedCb()
    {
      if (socketSandbox.socket === null)
      {
        return;
      }

      cb.apply(this, arguments);
    };
  };

  return SocketSandbox;
});
