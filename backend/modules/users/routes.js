/*jshint maxparams:5*/

'use strict';

var lodash = require('lodash');
var bcrypt = require('bcrypt');
var crud = require('../express/crud');

module.exports = function setUpUsersRoutes(app, usersModule)
{
  var express = app[usersModule.config.expressId];
  var auth = app[usersModule.config.userId].auth;
  var User = app[usersModule.config.mongooseId].model('User');

  var canView = auth('USERS_VIEW');
  var canManage = auth('USERS_MANAGE');

  express.get('/users', canView, crud.browseRoute.bind(null, app, User));

  express.post(
    '/users', canManage, hashPassword, crud.addRoute.bind(null, app, User)
  );

  express.get(
    '/users/:id', canViewDetails, crud.readRoute.bind(null, app, User)
  );

  express.put(
    '/users/:id', canManage, hashPassword, crud.editRoute.bind(null, app, User)
  );

  express.del('/users/:id', canManage, crud.deleteRoute.bind(null, app, User));

  express.post('/login', loginRoute);

  express.get('/logout', logoutRoute);

  function canViewDetails(req, res, next)
  {
    if (req.session.user && req.params.id === req.session.user._id)
    {
      next();
    }
    else
    {
      canView(req, res, next);
    }
  }

  function loginRoute(req, res, next)
  {
    var credentials = req.body;
    var config = app.user.config;

    if (credentials.login === config.super.login)
    {
      return authUser(
        credentials, lodash.merge({}, config.super), req, res, next
      );
    }

    User.findOne({login: credentials.login}, function(err, user)
    {
      if (err)
      {
        return next(err);
      }

      if (!user)
      {
        app.broker.publish('users.loginFailure', {
          severity: 'warning',
          login: credentials.login
        });

        return setTimeout(res.send.bind(res, 401), 1000);
      }

      authUser(credentials, user.toObject(), req, res, next);
    });
  }

  function authUser(credentials, user, req, res, next)
  {
    var password = String(credentials.password);
    var hash = user.password;

    bcrypt.compare(password, hash, function(err, result)
    {
      if (err)
      {
        return next(err);
      }

      if (!result)
      {
        app.broker.publish('users.loginFailure', {
          severity: 'warning',
          login: credentials.login
        });

        return setTimeout(res.send.bind(res, 401), 1000);
      }

      req.session.regenerate(function(err)
      {
        if (err)
        {
          return next(err);
        }

        delete user.password;

        user.loggedIn = true;
        user.ipAddress = req.socket.remoteAddress;
        user.local = app.user.isLocalIpAddress(user.ipAddress);

        req.session.user = user;

        if (req.is('json'))
        {
          res.send(req.session.user);
        }
        else
        {
          res.redirect('/');
        }

        app.broker.publish('users.login', {
          user: user
        });
      });
    });
  }

  function logoutRoute(req, res, next)
  {
    var user = lodash.isObject(req.session.user)
      ? req.session.user
      : null;

    req.session.destroy(function(err)
    {
      if (err)
      {
        return next(err);
      }

      if (req.is('json'))
      {
        res.send(200);
      }
      else
      {
        res.redirect('/');
      }

      if (user !== null)
      {
        user.ipAddress = req.socket.remoteAddress;

        app.broker.publish('users.logout', {user: user});
      }
    });
  }

  /**
   * @private
   */
  function hashPassword(req, res, next)
  {
    if (!lodash.isObject(req.body))
    {
      return next();
    }

    var password = req.body.password;

    if (!lodash.isString(password) || password.length === 0)
    {
      return next();
    }

    bcrypt.hash(password, 10, function(err, hash)
    {
      if (err)
      {
        return next(err);
      }

      req.body.password = hash;

      next();
    });
  }
};
