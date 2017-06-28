// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'underscore',
  'socket.io',
  'app/broker',
  'app/core/Socket'
],
function(
  _,
  sio,
  broker,
  Socket
) {
  'use strict';

  var query = {};

  if (window.COMPUTERNAME)
  {
    query.COMPUTERNAME = window.COMPUTERNAME;
  }

  var socket = new Socket(sio({
    path: '/sio',
    transports: ['websocket'],
    timeout: 10000,
    reconnectionDelay: 500,
    autoConnect: false,
    query: query
  }));

  var wasConnected = false;
  var wasReconnecting = false;

  socket.on('connecting', function()
  {
    broker.publish('socket.connecting', false);
  });

  socket.on('connect', function()
  {
    if (!wasConnected)
    {
      wasConnected = true;

      broker.publish('socket.connected', false);
    }
  });

  socket.on('connect_error', function()
  {
    if (!wasConnected)
    {
      broker.publish('socket.connectFailed', false);
    }
  });

  socket.on('message', function(message)
  {
    broker.publish('socket.message', message);
  });

  socket.on('disconnect', function()
  {
    broker.publish('socket.disconnected');
  });

  socket.on('reconnecting', function()
  {
    wasReconnecting = true;

    broker.publish('socket.connecting', true);
  });

  socket.on('reconnect', function()
  {
    wasReconnecting = false;

    broker.publish('socket.connected', true);
  });

  socket.on('reconnect_error', function()
  {
    if (wasReconnecting)
    {
      wasReconnecting = false;

      broker.publish('socket.connectFailed', true);
    }
  });

  socket.on('error', function()
  {
    if (wasReconnecting)
    {
      broker.publish('socket.connectFailed', true);
    }
  });

  window.socket = socket;

  return socket;
});
