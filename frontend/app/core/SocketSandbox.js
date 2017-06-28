// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'underscore'
], function(
  _
) {
  'use strict';

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

    if (allListeners == null)
    {
      return;
    }

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

  SocketSandbox.prototype.sandbox = function()
  {
    return new SocketSandbox(this);
  };

  SocketSandbox.prototype.getId = function()
  {
    return this.socket.getId();
  };

  SocketSandbox.prototype.isConnected = function()
  {
    return this.socket.isConnected();
  };

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

  SocketSandbox.prototype.emit = function()
  {
    var args = Array.prototype.slice.call(arguments);
    var lastArgPos = args.length - 1;

    args[lastArgPos] = this.wrapCallback(args[lastArgPos]);

    this.socket.emit.apply(this.socket, args);

    return this;
  };

  SocketSandbox.prototype.send = function(data, cb)
  {
    this.socket.send(data, this.wrapCallback(cb));

    return this;
  };

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
