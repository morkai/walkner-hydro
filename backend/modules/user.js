// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var os = require('os');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var _ = require('lodash');
var bcrypt = require('bcrypt');
var step = require('h5.step');
var ObjectId = require('mongoose').Types.ObjectId;
var resolveIpAddress = require('./util/resolveIpAddress');

exports.DEFAULT_CONFIG = {
  sioId: 'sio',
  expressId: 'express',
  mongooseId: 'mongoose',
  privileges: [],
  root: {
    password: '$2a$10$qSJWcm1LtN0OzlSHkSRl..ZezbqHAjW2ZuHzBd.F0CTQoWBvf0uQi'
  },
  guest: {},
  localAddresses: null,
  loginFailureDelay: 1000
};

exports.start = function startUserModule(app, module)
{
  var localAddresses = module.config.localAddresses || getLocalAddresses();

  module.root = _.assign(module.config.root, {
    loggedIn: true,
    super: true,
    _id: '52a33b8bfb955dac8a92261b',
    login: 'root',
    privileges: []
  });

  module.guest = _.assign({privileges: []}, module.config.guest, {
    loggedIn: false,
    super: false,
    _id: '52a33b9cfb955dac8a92261c',
    login: 'guest',
    password: undefined
  });

  module.auth = createAuthMiddleware;
  module.authenticate = authenticate;
  module.getRealIp = getRealIp;
  module.isLocalIpAddress = isLocalIpAddress;
  module.isAllowedTo = isAllowedTo;
  module.createUserInfo = createUserInfo;

  app.onModuleReady([module.config.expressId, module.config.sioId], setUpSio);

  app.broker.subscribe('express.beforeRouter').setLimit(1).on('message', function(message)
  {
    var expressModule = message.module;
    var expressApp = expressModule.app;

    expressApp.use(ensureUserMiddleware);
  });

  /**
   * @private
   * @returns {Array.<string>}
   */
  function getLocalAddresses()
  {
    var localAddresses = [];

    _.forEach(os.networkInterfaces(), function(addresses)
    {
      _.forEach(addresses, function(address)
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
    if (ipAddress === '127.0.0.1')
    {
      return true;
    }

    for (var i = 0, l = localAddresses.length; i < l; ++i)
    {
      var pattern = localAddresses[i];

      if (typeof pattern === 'string')
      {
        if (ipAddress.indexOf(pattern) === 0)
        {
          return true;
        }
      }
      else if (pattern.test(ipAddress))
      {
        return true;
      }
    }

    return false;
  }

  /**
   * @private
   * @param {string} ipAddress
   * @returns {Object}
   */
  function createGuestData(ipAddress)
  {
    var user = _.cloneDeep(module.guest);

    user.ipAddress = ipAddress;
    user.local = isLocalIpAddress(ipAddress);

    return user;
  }

  function isAllowedTo(user, anyPrivileges)
  {
    if (!user)
    {
      return false;
    }

    if (user.super)
    {
      return true;
    }

    if (typeof anyPrivileges === 'string')
    {
      anyPrivileges = [[anyPrivileges]];
    }

    if (anyPrivileges.length
      && user.local
      && anyPrivileges[0].some(function(privilege) { return privilege === 'LOCAL'; }))
    {
      return true;
    }

    if (!user.privileges)
    {
      return false;
    }

    if (!anyPrivileges.length)
    {
      return true;
    }

    for (var i = 0, l = anyPrivileges.length; i < l; ++i)
    {
      var allPrivileges = anyPrivileges[i];
      var matches = 0;

      for (var ii = 0, ll = allPrivileges.length; ii < ll; ++ii)
      {
        var privilege = allPrivileges[ii];

        if (privilege === 'USER')
        {
          matches += user.loggedIn ? 1 : 0;
        }
        else
        {
          matches += hasPrivilege(user, allPrivileges[ii]) ? 1 : 0;
        }
      }

      if (matches === allPrivileges.length)
      {
        return true;
      }
    }

    return false;
  }

  function preparePrivileges(user)
  {
    if (!Array.isArray(user.privileges))
    {
      user.privileges = [];
    }

    user.privilegesString = '|' + user.privileges.join('|');
    user.privilegesMap = {};

    _.forEach(user.privileges, function(privilege) { user.privilegesMap[privilege] = true; });

    return user;
  }

  function hasPrivilege(user, privilege)
  {
    if (_.isEmpty(user.privilegesString))
    {
      preparePrivileges(user);
    }

    if (privilege.charAt(privilege.length - 1) === '*')
    {
      return user.privilegesString.indexOf('|' + privilege.substr(0, privilege.length - 1)) !== -1;
    }

    return user.privilegesMap[privilege] === true;
  }

  function ensureUserMiddleware(req, res, next)
  {
    if (!req.session)
    {
      return next();
    }

    var user = req.session.user;

    if (!user)
    {
      req.session.user = createGuestData(getRealIp({}, req));
    }

    return next();
  }

  /**
   * @returns {function(object, object, function)}
   */
  function createAuthMiddleware()
  {
    var anyPrivileges = [];

    for (var i = 0, l = arguments.length; i < l; ++i)
    {
      var allPrivileges = arguments[i];

      if (!Array.isArray(allPrivileges))
      {
        allPrivileges = [allPrivileges];
      }

      anyPrivileges.push(allPrivileges);
    }

    return function authMiddleware(req, res, next)
    {
      var user = req.session.user;

      if (!user)
      {
        user = req.session.user = createGuestData(getRealIp({}, req));
      }

      if (isAllowedTo(user, anyPrivileges))
      {
        return next();
      }

      module.debug(
        "[auth] %s (%s) tried to access [%s] without sufficient privileges :(",
        user.login,
        user.ipAddress,
        req.url
      );

      return res.sendStatus(403);
    };
  }

  function authenticate(credentials, done)
  {
    if (!_.isString(credentials.login)
      || _.isEmpty(credentials.login)
      || !_.isString(credentials.password)
      || _.isEmpty(credentials.password))
    {
      return delayAuthFailure(new Error('INVALID_CREDENTIALS'), 400, done);
    }

    step(
      function findUserDataStep()
      {
        var next = this.next();

        if (credentials.login.toLowerCase() === module.root.login.toLowerCase())
        {
          next(null, _.assign({}, module.root));
        }
        else
        {
          var property = /^.*?@.*?\.[a-zA-Z]+$/.test(credentials.login) ? 'email' : 'login';
          var conditions = {
            [property]: new RegExp('^' + _.escapeRegExp(credentials.login) + '$', 'i'),
            active: true
          };

          app[module.config.mongooseId].model('User').findOne(conditions, next);
        }
      },
      function checkUserDataStep(err, userData)
      {
        if (err)
        {
          return this.done(delayAuthFailure.bind(null, err, 500, done));
        }

        if (!userData)
        {
          return this.done(delayAuthFailure.bind(null, new Error('INVALID_LOGIN'), 401, done));
        }

        if (_.isFunction(userData.toObject))
        {
          userData = userData.toObject();
        }

        this.userData = userData;
      },
      function comparePasswordStep()
      {
        bcrypt.compare(credentials.password, this.userData.password, this.next());
      },
      function handleComparePasswordResultStep(err, result)
      {
        if (err)
        {
          return this.done(delayAuthFailure.bind(null, err, 500, done));
        }

        if (!result)
        {
          return this.done(delayAuthFailure.bind(null, new Error('INVALID_PASSWORD'), 401, done));
        }

        return this.done(done, null, this.userData);
      }
    );
  }

  function delayAuthFailure(err, statusCode, done)
  {
    err.status = statusCode;

    setTimeout(done, module.config.loginFailureDelay, err);
  }

  function createUserInfo(userData, addressData)
  {
    if (!userData)
    {
      userData = {};
    }

    /**
     * @name UserInfo
     * @type {{id: string, ip: string, label: string}}
     */
    var userInfo = {
      id: null,
      ip: '',
      label: ''
    };

    try
    {
      userInfo.id = ObjectId.createFromHexString(String(userData._id || userData.id));
    }
    catch (err) {} // eslint-disable-line no-empty

    if (typeof userData.label === 'string')
    {
      userInfo.label = userData.label;
    }
    else if (userData.firstName && userData.lastName)
    {
      userInfo.label = userData.lastName + ' ' + userData.firstName;
    }
    else
    {
      userInfo.label = userData.login || '?';
    }

    userInfo.ip = getRealIp(userData, addressData);

    return userInfo;
  }

  function getRealIp(userData, addressData)
  {
    var ip = '';

    if (addressData)
    {
      ip = resolveIpAddress(addressData);
    }

    if (ip === '')
    {
      ip = userData.ip || userData.ipAddress || '0.0.0.0';
    }

    return ip;
  }

  /**
   * @private
   */
  function setUpSio()
  {
    var sioModule = app[module.config.sioId];
    var expressModule = app[module.config.expressId];
    var sosMap = {};
    var usersToSocketsMap = {};

    sioModule.use(function(socket, done)
    {
      var handshakeData = socket.handshake;
      var cookies = cookie.parse(String(handshakeData.headers.cookie));
      var sessionCookie = cookies[expressModule.config.sessionCookieKey];

      if (typeof sessionCookie !== 'string')
      {
        handshakeData.sessionId = String(Date.now() + Math.random());
        handshakeData.user = createGuestData(getRealIp({}, handshakeData));

        return done();
      }

      var sessionId = cookieParser.signedCookie(sessionCookie, expressModule.config.cookieSecret);

      expressModule.sessionStore.get(sessionId, function(err, session)
      {
        if (err)
        {
          return done(err);
        }

        handshakeData.sessionId = sessionId;
        handshakeData.user = session && session.user
          ? session.user
          : createGuestData(getRealIp({}, handshakeData));

        return done();
      });
    });

    sioModule.sockets.on('connection', function(socket)
    {
      var handshake = socket.handshake;

      if (handshake.sessionId)
      {
        socket.sessionId = handshake.sessionId;

        if (typeof sosMap[socket.sessionId] === 'undefined')
        {
          sosMap[socket.sessionId] = {};
        }

        sosMap[socket.sessionId][socket.id] = true;
      }

      if (handshake.user)
      {
        socket.emit('user.reload', socket.handshake.user);
      }

      mapUserToSocket(socket);

      socket.on('disconnect', function()
      {
        var userSockets = socket.handshake.user ? usersToSocketsMap[socket.handshake.user._id] : null;

        if (userSockets)
        {
          delete userSockets[socket.id];

          if (Object.keys(userSockets).length === 0)
          {
            delete userSockets[socket.handshake.user._id];
          }
        }

        var sessionSockets = sosMap[socket.sessionId];

        if (sessionSockets)
        {
          delete sessionSockets[socket.id];

          if (Object.keys(sessionSockets).length === 0)
          {
            delete sessionSockets[socket.sessionId];
          }
        }
      });
    });

    app.broker.subscribe('users.login', function(message)
    {
      var sockets = moveSos(message.oldSessionId, message.newSessionId);

      _.forEach(sockets, function(socket)
      {
        socket.handshake.sessionId = message.newSessionId;
        socket.handshake.user = message.user;

        mapUserToSocket(socket);

        if (socket.id !== message.socketId)
        {
          socket.emit('user.reload', message.user);
        }
      });
    });

    app.broker.subscribe('users.logout', function(message)
    {
      var sockets = moveSos(message.oldSessionId, message.newSessionId);
      var userId = message.user._id;
      var userToSocketsMap = usersToSocketsMap[userId];

      _.forEach(sockets, function(socket)
      {
        socket.handshake.sessionId = message.newSessionId;
        socket.handshake.user = createGuestData(getRealIp({}, socket));

        if (userToSocketsMap && userToSocketsMap[socket.id])
        {
          delete userToSocketsMap[socket.id];

          if (Object.keys(userToSocketsMap).length === 0)
          {
            delete usersToSocketsMap[userId];
          }
        }

        if (socket.id !== message.socketId)
        {
          socket.emit('user.reload', socket.handshake.user);
        }
      });
    });

    app.broker.subscribe('users.edited', function(message)
    {
      var userToSocketsMap = usersToSocketsMap[message.model._id];

      if (userToSocketsMap)
      {
        handleUserEdit(userToSocketsMap, message.model.toJSON());
      }
    });

    app.broker.subscribe('users.deleted', function(message)
    {
      var userToSocketsMap = usersToSocketsMap[message.model._id];

      if (userToSocketsMap)
      {
        handleUserDelete(userToSocketsMap, message.model._id);
      }
    });

    function mapUserToSocket(socket)
    {
      var handshake = socket.handshake;

      if (handshake.user && handshake.user.loggedIn)
      {
        var userId = handshake.user._id;

        if (!usersToSocketsMap[userId])
        {
          usersToSocketsMap[userId] = {};
        }

        usersToSocketsMap[userId][socket.id] = true;
      }
    }

    function moveSos(oldSessionId, newSessionId)
    {
      var sockets = [];

      if (typeof sosMap[oldSessionId] !== 'object')
      {
        return sockets;
      }

      _.forEach(Object.keys(sosMap[oldSessionId]), function(socketId)
      {
        var socket = sioModule.sockets.connected[socketId];

        if (typeof socket === 'undefined')
        {
          delete sosMap[oldSessionId][socketId];
        }
        else
        {
          socket.sessionId = newSessionId;

          sockets.push(socket);
        }
      });

      if (newSessionId !== oldSessionId)
      {
        sosMap[newSessionId] = sosMap[oldSessionId];

        delete sosMap[oldSessionId];
      }

      return sockets;
    }

    function getSessionsCollection()
    {
      var sessionStore = expressModule.sessionStore;

      if (typeof sessionStore.collection === 'function')
      {
        return sessionStore.collection();
      }

      return null;
    }

    function handleUserEdit(userToSocketsMap, userData)
    {
      var userId = userData._id.toString();

      delete userData._id;

      preparePrivileges(userData);
      updateUserSessions(userId, userData);
      updateUserSockets(userToSocketsMap, userData);
    }

    function handleUserDelete(userToSocketsMap, userId)
    {
      removeUserSessions(userId);

      _.forEach(userToSocketsMap, function(unused, socketId)
      {
        var socket = sioModule.sockets.connected[socketId];

        if (socket)
        {
          socket.emit('user.deleted');
        }
      });
    }

    function updateUserSockets(userToSocketsMap, userData)
    {
      _.forEach(userToSocketsMap, function(unused, socketId)
      {
        var socket = sioModule.sockets.connected[socketId];

        if (socket)
        {
          _.assign(socket.handshake.user, userData);

          socket.emit('user.reload', socket.handshake.user);
        }
      });
    }

    function updateUserSessions(userId, userData)
    {
      var collection = getSessionsCollection();

      if (!collection)
      {
        return;
      }

      var conditions = {
        'data.user._id': userId
      };
      var update = {
        $set: {}
      };

      _.forEach(userData, function(v, k)
      {
        update.$set['data.user.' + k] = v;
      });

      collection.update(conditions, update, {multi: true}, function(err)
      {
        if (err)
        {
          return module.error("Failed to update user sessions: %s", err.message);
        }
      });
    }

    function removeUserSessions(userId)
    {
      var collection = getSessionsCollection();

      if (!collection)
      {
        return;
      }

      collection.remove({'data.user._id': userId.toString()}, function(err)
      {
        if (err)
        {
          return module.error("Failed to remove user sessions: %s", err.message);
        }
      });
    }
  }
};
