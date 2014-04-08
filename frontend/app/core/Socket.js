// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  './SocketSandbox'
], function(
  SocketSandbox
) {
  'use strict';

  /**
   * @name app.core.Socket
   * @constructor
   * @param {SocketNamespace} sio
   */
  function Socket(sio)
  {
    /**
     * @private
     * @type {SocketNamespace}
     */
    this.sio = sio;
  }

  /**
   * @returns {app.core.SocketSandbox}
   */
  Socket.prototype.sandbox = function()
  {
    return new SocketSandbox(this);
  };

  /**
   * @returns {boolean}
   */
  Socket.prototype.isConnected = function()
  {
    return this.sio.socket.connected;
  };

  /**
   * @param {string} eventName
   * @param {Function} cb
   * @returns {app.core.Socket}
   */
  Socket.prototype.on = function(eventName, cb)
  {
    this.sio.addListener(eventName, cb);

    return this;
  };

  /**
   * @param {string} eventName
   * @param {function} [cb]
   * @returns {app.core.Socket}
   */
  Socket.prototype.off = function(eventName, cb)
  {
    if (typeof cb === 'undefined')
    {
      this.sio.removeAllListeners(eventName);
    }
    else
    {
      this.sio.removeListener(eventName, cb);
    }

    return this;
  };

  /**
   * @param {string} eventName
   * @param {...*} argN
   * @returns {app.core.Socket}
   */
  Socket.prototype.emit = function()
  {
    this.sio.json.emit.apply(this.sio.json, arguments);

    return this;
  };

  /**
   * @param {*} data
   * @param {function} [cb]
   * @returns {app.core.Socket}
   */
  Socket.prototype.send = function(data, cb)
  {
    this.sio.json.send(data, cb);

    return this;
  };

  Socket.prototype.reconnect = function()
  {
    if (!this.isConnected() && !this.sio.socket.reconnecting)
    {
      this.sio.socket.reconnect();
    }
  };

  return Socket;
});
