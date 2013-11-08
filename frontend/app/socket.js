define([
  'underscore',
  'socket.io',
  './broker',
  './core/Socket'
],
function(
  _,
  sio,
  broker,
  Socket
) {
  'use strict';

  var socket = new Socket(sio.connect('', {
    'resource': 'socket.io',
    'transports': [
      'websocket',
      'xhr-polling'
    ],
    'connect timeout': 5000,
    'reconnect': true,
    'reconnection delay': _.random(100, 200),
    'reconnection limit': _.random(2000, 3000),
    'max reconnection attempts': Infinity
  }));

  var wasConnected = false;

  socket.on('connect', function()
  {
    if (!wasConnected)
    {
      wasConnected = true;

      broker.publish('socket.connected');
    }
  });

  socket.on('connect_failed', function()
  {
    broker.publish('socket.connectFailed');
  });

  socket.on('message', function(message)
  {
    broker.publish('socket.message', message);
  });

  socket.on('disconnect', function()
  {
    broker.publish('socket.disconnected');
  });

  socket.on('reconnect', function()
  {
    broker.publish('socket.reconnected');
  });

  socket.on('reconnect_failed', function()
  {
    broker.publish('socket.reconnectFailed');
  });

  socket.on('error', forceReconnectOnFirstConnectFailure);

  /**
   * @private
   * @param {*} err
   */
  function forceReconnectOnFirstConnectFailure(err)
  {
    if (err === '' && !wasConnected)
    {
      socket.off('error', forceReconnectOnFirstConnectFailure);
      socket.reconnect();
    }
  }

  return socket;
});
