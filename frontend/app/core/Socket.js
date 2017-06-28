// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'app/core/SocketSandbox'
], function(
  SocketSandbox
) {
  'use strict';

  function Socket(sio)
  {
    this.sio = sio;
  }

  Socket.prototype.sandbox = function()
  {
    return new SocketSandbox(this);
  };

  Socket.prototype.getId = function()
  {
    return this.sio.id || null;
  };

  Socket.prototype.isConnected = function()
  {
    return this.sio.io.readyState === 'open';
  };

  Socket.prototype.isConnecting = function()
  {
    return this.sio.io.readyState === 'opening';
  };

  Socket.prototype.connect = function()
  {
    this.sio.open();
  };

  Socket.prototype.reconnect = function()
  {
    this.connect();
  };

  Socket.prototype.on = function(eventName, cb)
  {
    this.sio.on(eventName, cb);

    return this;
  };

  Socket.prototype.off = function(eventName, cb)
  {
    if (typeof cb === 'undefined')
    {
      this.sio.removeAllListeners(eventName);
    }
    else
    {
      this.sio.off(eventName, cb);
    }

    return this;
  };

  Socket.prototype.emit = function()
  {
    this.sio.json.emit.apply(this.sio.json, arguments);

    return this;
  };

  Socket.prototype.send = function(data, cb)
  {
    this.sio.json.send(data, cb);

    return this;
  };

  return Socket;
});
