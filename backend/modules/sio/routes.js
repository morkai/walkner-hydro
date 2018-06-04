// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');

module.exports = function setUpSioRoutes(app, module)
{
  const express = app[module.config.expressId];
  const userModule = app[module.config.userId];

  express.get('/sockets', userModule.auth('ADMIN'), function(req, res)
  {
    const sockets = [];
    const loginFilter = (req.query.login || '').trim().toLocaleLowerCase();
    const hostFilter = (req.query.host || '').trim().toLocaleLowerCase();
    const nameFilter = (req.query.name || '').trim().toLocaleLowerCase();

    _.forEach(module.sockets.connected, function(socket)
    {
      const handshake = socket.handshake;
      const user = handshake.user || {};
      const login = user.login;
      const host = handshake.query && handshake.query.COMPUTERNAME;
      const name = ((user.lastName || '') + ' ' + (user.firstName || '')).trim();

      if (filterSocket(loginFilter, login) || filterSocket(hostFilter, host) || filterSocket(nameFilter, name))
      {
        return;
      }

      sockets.push({
        _id: socket.id,
        host: host,
        ip: user.ipAddress,
        user: user._id,
        login: login,
        name: name,
        connectedAt: handshake.connectedAt
      });
    });

    sockets.sort(function(a, b)
    {
      const cmp = a.login.localeCompare(b.login);

      return cmp === 0 ? a._id.localeCompare(b._id) : cmp;
    });

    res.json({
      totalCount: sockets.length,
      collection: sockets
    });
  });

  function filterSocket(filter, value)
  {
    return filter !== '' && (typeof value !== 'string' || !value.toLocaleLowerCase().includes(filter));
  }
};
