// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const {exec} = require('child_process');
const _ = require('lodash');
const engineIo = require('engine.io');
const socketIo = require('socket.io');
const SocketIoMultiServer = require('./SocketIoMultiServer');
const setUpRoutes = require('./routes');
let pmx = null;

try { pmx = require('pmx'); }
catch (err) {} // eslint-disable-line no-empty

engineIo.Server.errors.SERVER_UNAVAILABLE = 503;
engineIo.Server.errorMessages[503] = 'Server unavailable';

exports.DEFAULT_CONFIG = {
  httpServerIds: ['httpServer'],
  expressId: 'express',
  userId: 'user',
  pingsId: 'pings',
  path: '/sio',
  socketIo: {
    pingInterval: 30000,
    pingTimeout: 10000
  },
  netstatCmd: ''
};

exports.start = function startSioModule(app, sioModule, done)
{
  sioModule.config.socketIo = _.assign({}, sioModule.config.socketIo, {
    path: sioModule.config.path,
    transports: ['websocket', 'xhr-polling'],
    serveClient: false,
    allowRequest: checkRequest
  });

  let socketCount = 0;
  const probes = {
    currentUsersCounter: null,
    totalConnectionTime: null,
    totalConnectionCount: null
  };

  if (pmx)
  {
    const pmxProbe = pmx.probe();

    probes.currentUsersCounter = pmxProbe.counter({name: 'sio:currentUsers'});
    probes.totalConnectionTime = pmxProbe.histogram({name: 'sio:totalConnectionTime', measurement: 'sum'});
    probes.totalConnectionCount = pmxProbe.histogram({name: 'sio:totalConnectionCount', measurement: 'sum'});
  }

  const multiServer = new SocketIoMultiServer();

  app.onModuleReady(sioModule.config.httpServerIds, function()
  {
    _.forEach(sioModule.config.httpServerIds, function(httpServerId)
    {
      multiServer.addServer(app[httpServerId].server);
    });

    startSocketIo();

    done();
  });

  function checkRequest(req, done)
  {
    const allServersAvailable = sioModule.config.httpServerIds.every(httpServerId => app[httpServerId].isAvailable());

    if (!allServersAvailable)
    {
      return done(engineIo.Server.errors.SERVER_UNAVAILABLE, false);
    }

    return sioModule.checkRequest(req, done);
  }

  function startSocketIo()
  {
    const sio = socketIo(multiServer, sioModule.config.socketIo);

    sioModule = app[sioModule.name] = _.assign(sio, sioModule);

    sio.sockets.setMaxListeners(25);

    app.onModuleReady(
      [
        sioModule.config.expressId,
        sioModule.config.userId
      ],
      setUpRoutes.bind(null, app, sioModule)
    );

    sioModule.on('connection', function(socket)
    {
      ++socketCount;

      socket.handshake.connectedAt = Date.now();

      if (pmx)
      {
        probes.currentUsersCounter.inc();
      }

      if (app[sioModule.config.pingsId])
      {
        app[sioModule.config.pingsId].recordHttpRequest(socket.conn.request);
      }

      app.broker.publish('sockets.connected', {
        socket: {
          _id: socket.id,
          headers: socket.handshake.headers || {},
          user: socket.handshake.user || {}
        },
        socketCount: socketCount
      });

      socket.on('disconnect', function()
      {
        --socketCount;

        if (pmx)
        {
          probes.totalConnectionCount.update(1);
          probes.totalConnectionTime.update((Date.now() - socket.handshake.connectedAt) / 1000);
          probes.currentUsersCounter.dec();
        }

        app.broker.publish('sockets.disconnected', {
          socketId: socket.id,
          socketCount: socketCount
        });
      });

      socket.on('echo', function()
      {
        socket.emit.apply(socket, ['echo'].concat(Array.prototype.slice.call(arguments)));
      });

      socket.on('time', function(reply)
      {
        if (_.isFunction(reply))
        {
          reply(Date.now(), 'Europe/Warsaw');
        }
      });

      socket.on('killZombies', function()
      {
        if (socket.handshake && socket.handshake.user && socket.handshake.user.super)
        {
          killZombies();
        }
      });
    });
  }

  function killZombies()
  {
    netstat((err, established) => // eslint-disable-line handle-callback-err
    {
      const oldSocketIds = Object.keys(sioModule.sockets.connected);

      oldSocketIds.forEach(socketId =>
      {
        const ioSocket = sioModule.sockets.connected[socketId];
        const nodeSocket = ioSocket.request.socket;
        const foreignAddress = `${nodeSocket.remoteAddress}:${nodeSocket.remotePort}`;

        if (!established.has(foreignAddress)
          || !nodeSocket.readable
          || !nodeSocket.writable
          || nodeSocket.destroyed)
        {
          ioSocket.disconnect(true);
        }
      });

      const newSocketIds = Object.keys(sioModule.sockets.connected);

      if (newSocketIds.length < oldSocketIds.length)
      {
        sioModule.debug(`Killed ${oldSocketIds.length - newSocketIds.length} zombies!`);
      }
    });
  }

  function netstat(done)
  {
    const win32 = process.platform === 'win32';
    const cmd = sioModule.config.netstatCmd || (win32 ? 'netstat -p tcp -n' : 'netstat -ant | grep ESTABLISHED');

    exec(cmd, (err, stdout) =>
    {
      const established = new Set();
      const partIndex = win32 ? 2 : 4;

      (stdout || '').trim().split('\n').forEach(line =>
      {
        const parts = line.replace(/\s+/g, ' ').trim().split(' ');
        const foreignAddress = parts[partIndex];
        const state = parts[partIndex + 1];

        if (state === 'ESTABLISHED')
        {
          established.add(foreignAddress);
        }
      });

      done(err, established);
    });
  }
};
