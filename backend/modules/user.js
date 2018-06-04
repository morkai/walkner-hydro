// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const os = require('os');
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const _ = require('lodash');
const bcrypt = require('bcrypt');
const step = require('h5.step');
const ObjectId = require('mongoose').Types.ObjectId;
const resolveIpAddress = require('./util/resolveIpAddress');

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
  loginFailureDelay: 1000,
  userInfoIdProperty: '_id'
};

exports.start = function startUserModule(app, module)
{
  const localAddresses = module.config.localAddresses || getLocalAddresses();

  module.root = _.assign(module.config.root, {
    loggedIn: true,
    super: true,
    _id: '52a33b8bfb955dac8a92261b',
    login: 'root',
    privileges: ['SUPER']
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
    const expressModule = message.module;
    const expressApp = expressModule.app;

    expressApp.use(ensureUserMiddleware);
  });

  /**
   * @private
   * @returns {Array.<string>}
   */
  function getLocalAddresses()
  {
    const localAddresses = [];

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

    for (let i = 0, l = localAddresses.length; i < l; ++i)
    {
      const pattern = localAddresses[i];

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
    const user = _.cloneDeep(module.guest);

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

    for (let i = 0, l = anyPrivileges.length; i < l; ++i)
    {
      const allPrivileges = anyPrivileges[i];
      let matches = 0;

      for (let ii = 0; ii < allPrivileges.length; ++ii)
      {
        const privilege = allPrivileges[ii];

        if (privilege === 'USER')
        {
          matches += user.loggedIn ? 1 : 0;
        }
        else if (/^FN:/.test(privilege))
        {
          matches += user.prodFunction === privilege.substring(3) ? 1 : 0;
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

    const user = req.session.user;

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
    const anyPrivileges = [];

    for (let i = 0, l = arguments.length; i < l; ++i)
    {
      let allPrivileges = arguments[i];

      if (!Array.isArray(allPrivileges))
      {
        allPrivileges = [allPrivileges];
      }

      anyPrivileges.push(allPrivileges);
    }

    return function authMiddleware(req, res, next)
    {
      if (req.session)
      {
        let user = req.session.user;

        if (!user)
        {
          user = req.session.user = createGuestData(getRealIp({}, req));
        }

        if (isAllowedTo(user, anyPrivileges))
        {
          return next();
        }

        module.debug(
          '[auth] %s (%s) tried to access [%s] without sufficient privileges :(',
          user.login,
          user.ipAddress,
          req.url
        );
      }

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
        const next = this.next();

        if (credentials.login.toLowerCase() === module.root.login.toLowerCase())
        {
          next(null, _.assign({}, module.root));
        }
        else
        {
          const User = app[module.config.mongooseId].model('User');
          const property = /^.*?@.*?\.[a-zA-Z]+$/.test(credentials.login) ? 'email' : 'login';
          const conditions = {
            [property]: new RegExp('^' + _.escapeRegExp(credentials.login) + '$', 'i')
          };

          if (User.schema.path('active'))
          {
            conditions.active = true;
          }

          User.findOne(conditions, next);
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
    const userInfo = {
      [module.config.userInfoIdProperty]: null,
      ip: '',
      label: ''
    };

    try
    {
      userInfo[module.config.userInfoIdProperty] = ObjectId.createFromHexString(String(userData._id || userData.id));
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
    let ip = '';

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
    const sioModule = app[module.config.sioId];
    const expressModule = app[module.config.expressId];
    const sosMap = {};
    const usersToSocketsMap = {};

    sioModule.use(function(socket, done)
    {
      const handshakeData = socket.handshake;
      const cookies = cookie.parse(String(handshakeData.headers.cookie));
      const sessionCookie = cookies[expressModule.config.sessionCookieKey];

      if (typeof sessionCookie !== 'string')
      {
        handshakeData.sessionId = String(Date.now() + Math.random());
        handshakeData.user = createGuestData(getRealIp({}, handshakeData));

        return done();
      }

      const sessionId = cookieParser.signedCookie(sessionCookie, expressModule.config.cookieSecret);

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
      const handshake = socket.handshake;

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
        const userSockets = socket.handshake.user ? usersToSocketsMap[socket.handshake.user._id] : null;

        if (userSockets)
        {
          delete userSockets[socket.id];

          if (Object.keys(userSockets).length === 0)
          {
            delete userSockets[socket.handshake.user._id];
          }
        }

        const sessionSockets = sosMap[socket.sessionId];

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
      const sockets = moveSos(message.oldSessionId, message.newSessionId);

      _.forEach(sockets, function(socket)
      {
        socket.handshake.sessionId = message.newSessionId;
        socket.handshake.user = message.user;

        mapUserToSocket(socket);

        socket.emit('user.reload', message.user);
      });
    });

    app.broker.subscribe('users.logout', function(message)
    {
      const sockets = moveSos(message.oldSessionId, message.newSessionId);
      const userId = message.user._id;
      const userToSocketsMap = usersToSocketsMap[userId];

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

        socket.emit('user.reload', socket.handshake.user);
      });
    });

    app.broker.subscribe('users.edited', function(message)
    {
      const userToSocketsMap = usersToSocketsMap[message.model._id];

      if (userToSocketsMap)
      {
        handleUserEdit(userToSocketsMap, message.model.toJSON());
      }
    });

    app.broker.subscribe('users.deleted', function(message)
    {
      const userToSocketsMap = usersToSocketsMap[message.model._id];

      if (userToSocketsMap)
      {
        handleUserDelete(userToSocketsMap, message.model._id);
      }
    });

    function mapUserToSocket(socket)
    {
      const handshake = socket.handshake;

      if (handshake.user && handshake.user.loggedIn)
      {
        const userId = handshake.user._id;

        if (!usersToSocketsMap[userId])
        {
          usersToSocketsMap[userId] = {};
        }

        usersToSocketsMap[userId][socket.id] = true;
      }
    }

    function moveSos(oldSessionId, newSessionId)
    {
      const sockets = [];

      if (typeof sosMap[oldSessionId] !== 'object')
      {
        return sockets;
      }

      _.forEach(Object.keys(sosMap[oldSessionId]), function(socketId)
      {
        const socket = sioModule.sockets.connected[socketId];

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
      const sessionStore = expressModule.sessionStore;

      if (typeof sessionStore.collection === 'function')
      {
        return sessionStore.collection();
      }

      return null;
    }

    function handleUserEdit(userToSocketsMap, userData)
    {
      const userId = userData._id.toString();

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
        const socket = sioModule.sockets.connected[socketId];

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
        const socket = sioModule.sockets.connected[socketId];

        if (socket)
        {
          _.assign(socket.handshake.user, userData);

          socket.emit('user.reload', socket.handshake.user);
        }
      });
    }

    function updateUserSessions(userId, userData)
    {
      const collection = getSessionsCollection();

      if (!collection)
      {
        return;
      }

      const conditions = {
        'data.user._id': userId
      };
      const update = {
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
          return module.error('Failed to update user sessions: %s', err.message);
        }
      });
    }

    function removeUserSessions(userId)
    {
      const collection = getSessionsCollection();

      if (!collection)
      {
        return;
      }

      collection.remove({'data.user._id': userId.toString()}, function(err)
      {
        if (err)
        {
          return module.error('Failed to remove user sessions: %s', err.message);
        }
      });
    }
  }
};
