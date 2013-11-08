'use strict';

var os = require('os');
var connect = require('connect');
var cookie = require('cookie');
var lodash = require('lodash');

exports.DEFAULT_CONFIG = {
  sioId: 'sio',
  expressId: 'express',
  super: {
    loggedIn: true,
    _id: 'admin1234567890123456789',
    login: 'root',
    password: '$2a$10$sLb4bPlmgdx7/2.pnEYEPutRTSZoCSBXIFL9GKXW6bDVQ3..V2ftq',
    email: '',
    mobile: '',
    privileges: [
      'SETTINGS_VIEW',
      'SETTINGS_MANAGE',
      'MONITORING_VIEW',
      'DIAGNOSTICS_VIEW',
      'ANALYTICS_VIEW',
      'EVENTS_VIEW',
      'EVENTS_MANAGE',
      'ALARMS_VIEW',
      'ALARMS_MANAGE',
      'ALARMS_ACK',
      'ALARMS_BREAKIN',
      'USERS_VIEW',
      'USERS_MANAGE'
    ]
  },
  guest: {
    loggedIn: false,
    _id: 'guest1234567890123456789',
    login: 'guest',
    password: Date.now() + '' + Math.random().toString(),
    email: '',
    mobile: '',
    privileges: []
  }
};

exports.start = function startUserModule(app, module)
{
  var localAddresses = getLocalAddresses();

  module.allPrivileges = module.config.super.privileges;
  module.auth = createAuthMiddleware;
  module.isLocalIpAddress = isLocalIpAddress;

  app.onModuleReady(module.config.expressId, function()
  {
    app.onModuleReady(module.config.sioId, setUpSioAuth);
  });

  /**
   * @private
   * @returns {Array.<string>}
   */
  function getLocalAddresses()
  {
    var localAddresses = [];

    lodash.each(os.networkInterfaces(), function(addresses)
    {
      addresses.forEach(function(address)
      {
        if (address.family === 'IPv4')
        {
          localAddresses.push(address.address.replace(/\.[0-9]+$/, ''));
        }
      });
    });

    return localAddresses;
  }

  /**
   * @param {string} ipAddress
   * @returns {boolean}
   */
  function isLocalIpAddress(ipAddress)
  {
    return localAddresses.indexOf(ipAddress.replace(/\.[0-9]+$/, '')) !== -1;
  }

  /**
   * @param {string|Array.<string>} requiredPrivileges
   * @returns {function(object, object, function)}
   */
  function createAuthMiddleware(requiredPrivileges)
  {
    if (!Array.isArray(requiredPrivileges))
    {
      requiredPrivileges = requiredPrivileges ? [requiredPrivileges] : [];
    }

    var l = requiredPrivileges.length;

    return function(req, res, next)
    {
      if (!req.session.user)
      {
        req.session.user = module.config.guest;
      }

      var user = req.session.user;

      if (!user || !user.privileges)
      {
        return res.send(401);
      }

      if (l === 0 && !user.loggedIn)
      {
        return res.send(401);
      }

      for (var i = 0; i < l; ++i)
      {
        if (user.privileges.indexOf(requiredPrivileges[i]) === -1)
        {
          return res.send(401);
        }
      }

      return next();
    };
  }

  /**
   * @private
   */
  function setUpSioAuth()
  {
    app[module.config.sioId].set('authorization', function(handshakeData, done)
    {
      var express = app[module.config.expressId];
      var cookies = cookie.parse(String(handshakeData.headers.cookie));
      var sessionCookie = cookies[express.config.sessionCookieKey];
      var sid = connect.utils.parseSignedCookie(
        sessionCookie, express.config.cookieSecret
      );

      express.sessionStore.get(sid, function(err, session)
      {
        if (err)
        {
          return done(err);
        }

        if (!lodash.isObject(session) || !lodash.isObject(session.user))
        {
          return done(null, false);
        }

        handshakeData.sid = sid;
        handshakeData.user = session.user;

        done(null, !!session.user.loggedIn);
      });
    });
  }
};
