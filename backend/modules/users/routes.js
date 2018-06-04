// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const fs = require('fs-extra');
const _ = require('lodash');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const step = require('h5.step');

module.exports = function setUpUsersRoutes(app, usersModule)
{
  const express = app[usersModule.config.expressId];
  const userModule = app[usersModule.config.userId];
  const settingsModule = app[usersModule.config.settingsId];
  const mongoose = app[usersModule.config.mongooseId];
  const User = mongoose.model('User');
  const PasswordResetRequest = mongoose.model('PasswordResetRequest');

  const canView = userModule.auth('USERS:VIEW');
  const canBrowse = userModule.auth.apply(userModule, usersModule.config.browsePrivileges);
  const canManage = userModule.auth('USERS:MANAGE');

  if (settingsModule)
  {
    express.get(
      '/users/settings',
      canBrowse,
      function limitToUsersSettings(req, res, next)
      {
        req.rql.selector = {
          name: 'regex',
          args: ['_id', '^users\\.']
        };

        return next();
      },
      express.crud.browseRoute.bind(null, app, settingsModule.Setting)
    );
    express.put('/users/settings/:id', canManage, settingsModule.updateRoute);
  }

  express.get('/users', canBrowse, express.crud.browseRoute.bind(null, app, User));
  express.post('/users', canManage, checkLogin, hashPassword, express.crud.addRoute.bind(null, app, User));
  express.get('/users/:id', canViewDetails, express.crud.readRoute.bind(null, app, User));
  express.put(
    '/users/:id',
    canEdit,
    restrictSpecial,
    checkLogin,
    hashPassword,
    express.crud.editRoute.bind(null, app, User)
  );
  express.delete('/users/:id', canManage, restrictSpecial, express.crud.deleteRoute.bind(null, app, User));

  express.post('/users/:id/anonymize', userModule.auth('SUPER'), anonymizeUserRoute);

  express.post('/login', loginRoute);
  express.get('/logout', logoutRoute);

  express.post('/resetPassword/request', hashPassword, requestPasswordResetRoute);
  express.get('/resetPassword/:id', confirmPasswordResetRoute);

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

  function canEdit(req, res, next)
  {
    const user = req.session.user;

    if (user && req.params.id === user._id)
    {
      if (!user.privileges || user.privileges.indexOf('USERS:MANAGE') === -1)
      {
        req.body = _.pick(req.body, [
          '_id',
          'login', 'email', 'password', 'password2',
          'firstName', 'lastName', 'sex', 'mobile', 'personellId',
          'mrps'
        ]);
      }

      next();
    }
    else
    {
      canManage(req, res, next);
    }
  }

  function restrictSpecial(req, res, next)
  {
    if (req.params.id === userModule.root._id || req.params.id === userModule.guest._id)
    {
      return res.sendStatus(400);
    }

    return next();
  }

  function checkLogin(req, res, next)
  {
    const rawLogin = req.body.login;

    if (!_.isString(rawLogin) || !req.body.active)
    {
      return next();
    }

    const login = req.body.login = rawLogin.trim();
    const conditions = {
      login,
      active: true
    };

    if (req.body._id)
    {
      conditions._id = {$ne: req.body._id};
    }

    User.findOne(conditions, {_id: 1}).lean().exec(function(err, user)
    {
      if (err)
      {
        return next(err);
      }

      if (user)
      {
        return next(app.createError('LOGIN_USED', 400));
      }

      return next();
    });
  }

  function loginRoute(req, res, next)
  {
    userModule.authenticate(req.body, function(err, user)
    {
      if (err)
      {
        if (err.status < 500)
        {
          app.broker.publish('users.loginFailure', {
            severity: 'warning',
            user: req.session.user,
            login: String(req.body.login)
          });
        }

        return next(err);
      }

      const oldSessionId = req.sessionID;

      req.session.regenerate(function(err)
      {
        if (err)
        {
          return next(err);
        }

        delete user.password;

        user._id = user._id.toString();
        user.loggedIn = true;
        user.ipAddress = userModule.getRealIp({}, req);
        user.local = userModule.isLocalIpAddress(user.ipAddress);
        user.super = _.includes(user.privileges, 'SUPER');

        req.session.user = user;

        res.format({
          json: function()
          {
            res.send(req.session.user);
          },
          default: function()
          {
            res.redirect('/');
          }
        });

        app.broker.publish('users.login', {
          user: user,
          oldSessionId: oldSessionId,
          newSessionId: req.sessionID,
          socketId: req.body.socketId
        });
      });
    });
  }

  function logoutRoute(req, res, next)
  {
    const user = _.isObject(req.session.user)
      ? req.session.user
      : null;

    const oldSessionId = req.sessionID;

    req.session.regenerate(function(err)
    {
      if (err)
      {
        return next(err);
      }

      const guestUser = _.assign({}, userModule.guest);
      guestUser.loggedIn = false;
      guestUser.ipAddress = userModule.getRealIp({}, req);
      guestUser.local = userModule.isLocalIpAddress(guestUser.ipAddress);
      guestUser.super = false;

      req.session.user = guestUser;

      res.format({
        json: function()
        {
          res.sendStatus(204);
        },
        default: function()
        {
          res.redirect('/');
        }
      });

      if (user !== null)
      {
        user.ipAddress = guestUser.ipAddress;

        app.broker.publish('users.logout', {
          user: user,
          oldSessionId: oldSessionId,
          newSessionId: req.sessionID
        });
      }
    });
  }

  function requestPasswordResetRoute(req, res, next)
  {
    const mailSender = app[usersModule.config.mailSenderId];

    if (!mailSender)
    {
      return res.sendStatus(500);
    }

    const body = req.body;

    if (!_.isString(body.subject)
      || !_.isString(body.text)
      || !_.isString(body.login)
      || !_.isString(body.passwordText))
    {
      return res.sendStatus(400);
    }

    step(
      function findUserStep()
      {
        User.findOne({login: body.login}, {login: 1, email: 1}).lean().exec(this.next());
      },
      function validateUserStep(err, user)
      {
        if (err)
        {
          return this.skip(err);
        }

        if (!user)
        {
          return this.skip(app.createError('NOT_FOUND', 404));
        }

        if (!/^.+@.+\.[a-z]+$/.test(user.email))
        {
          return this.skip(app.createError('INVALID_EMAIL', 400));
        }

        this.user = user;
      },
      function generateIdStep()
      {
        crypto.pseudoRandomBytes(32, this.next());
      },
      function createPasswordResetRequestStep(err, idBytes)
      {
        if (err)
        {
          return this.skip(err);
        }

        this.passwordResetRequest = new PasswordResetRequest({
          _id: idBytes.toString('hex').toUpperCase(),
          createdAt: new Date(),
          creator: userModule.createUserInfo(req.session.user, req),
          user: this.user._id,
          password: body.password
        });
        this.passwordResetRequest.save(this.next());
      },
      function sendEmailStep(err)
      {
        if (err)
        {
          return this.skip(err);
        }

        const subject = body.subject;
        const text = body.text
          .replace(/\{REQUEST_ID\}/g, this.passwordResetRequest._id)
          .replace(/\{LOGIN\}/g, this.user.login)
          .replace(/\{PASSWORD\}/g, body.passwordText);

        mailSender.send(this.user.email, subject, text, this.next());
      },
      function sendResponseStep(err)
      {
        if (err)
        {
          return next(err);
        }

        return res.sendStatus(204);
      }
    );
  }

  function confirmPasswordResetRoute(req, res, next)
  {
    step(
      function findRequestStep()
      {
        PasswordResetRequest.findById(req.params.id, this.next());
      },
      function validateRequestStep(err, passwordResetRequest)
      {
        if (err)
        {
          return this.skip(err);
        }

        if (!passwordResetRequest)
        {
          return this.skip(app.createError('REQUEST_NOT_FOUND', 404));
        }

        if ((Date.now() - passwordResetRequest.createdAt.getTime()) > 3600 * 24 * 1000)
        {
          return this.skip(app.createError('REQUEST_EXPIRED', 400));
        }

        this.passwordResetRequest = passwordResetRequest;
      },
      function findUserStep()
      {
        User.findById(this.passwordResetRequest.user, this.next());
      },
      function validateUserStep(err, user)
      {
        if (err)
        {
          return this.skip(err);
        }

        if (!user)
        {
          return this.skip(app.createError('USER_NOT_FOUND', 400));
        }

        this.user = user;
      },
      function updatePasswordStep()
      {
        this.user.password = this.passwordResetRequest.password;
        this.user.save(this.next());
      },
      function sendResponseStep(err)
      {
        if (err)
        {
          return next(err);
        }

        res.redirect(303, '/');

        if (this.passwordResetRequest)
        {
          const passwordResetRequest = this.passwordResetRequest;

          passwordResetRequest.remove(err =>
          {
            if (err)
            {
              usersModule.error(
                'Failed to remove the password reset request [%s]: %s',
                passwordResetRequest._id,
                err.message
              );
            }
          });
        }

        this.passwordResetRequest = null;
        this.user = null;
      }
    );
  }

  function anonymizeUserRoute(req, res)
  {
    const modelsToUpdate = {
      BehaviorObsCard: {
        condition: ['users'],
        update: ['creator', 'updater', 'observer', 'superior']
      },
      D8Area: {
        condition: ['manager']
      },
      D8Entry: {
        condition: ['observers.user', 'changes.user'],
        update: ['creator', 'updater', 'owner', 'manager', 'members', 'observers.user', 'changes.user']
      },
      Event: {
        condition: ['user'],
        update: ['user'],
        custom: anonymizeEvents
      },
      FteLeaderEntry: {
        condition: ['creator', 'updater']
      },
      FteMasterEntry: {
        condition: ['creator', 'updater']
      },
      HourlyPlan: {
        condition: ['creator', 'updater']
      },
      InvalidOrder: {
        condition: ['updater']
      },
      IsaEvent: {
        condition: ['user', 'data.responder']
      },
      IsaRequest: {
        condition: ['requester', 'responder', 'finisher']
      },
      IsaShiftPersonnel: {
        condition: ['users+']
      },
      KaizenOrder: {
        condition: ['finisher', 'observers.user', 'changes.user'],
        update: [
          'creator',
          'updater',
          'confirmer',
          'finisher',
          'nearMissOwners',
          'suggestionOwners',
          'kaizenOwners',
          'owners',
          'observers.user',
          'changes.user'
        ]
      },
      KaizenProductFamily: {
        condition: ['owners']
      },
      MinutesForSafetyCard: {
        condition: ['users'],
        update: [
          'creator',
          'updater',
          'owner',
          'orgPropositions.who',
          'techPropositions.who',
          'participants'
        ]
      },
      OpinionSurvey: {
        condition: ['superiors'],
        update: ['superiors.full!', 'superiors.short!'],
        custom: anonymizeOpinionSurveys
      },
      OpinionSurveyAction: {
        condition: ['creator', 'updater', 'participants'],
        update: ['creator', 'updater', 'owners', 'superior']
      },
      OpinionSurveyResponse: {
        condition: ['creator']
      },
      Order: {
        condition: ['changes.user']
      },
      PaintShopEvent: {
        condition: ['user']
      },
      PlanChange: {
        condition: ['user']
      },
      PressWorksheet: {
        condition: ['creator', 'updater', 'master', 'operator', 'operators']
      },
      // TODO Data?
      ProdChangeRequest: {
        condition: ['creator', 'confirmer']
      },
      ProdDowntime: {
        condition: ['corroborator', 'creator', 'master', 'leader', 'operator', 'operators', 'changes.user']
      },
      ProdDowntimeAlert: {
        condition: ['usedObjects'],
        update: ['userWhitelist+', 'userBlacklist+', 'usedObjects', 'actions.userWhitelist+', 'actions.userBlacklist+']
      },
      ProdLogEntry: {
        condition: ['creator'],
        custom: anonymizeProdLogEntries
      },
      ProdShift: {
        condition: ['creator', 'master', 'leader', 'operator', 'operators']
      },
      ProdShiftOrder: {
        condition: ['creator', 'master', 'leader', 'operator', 'operators']
      },
      PscsResult: {
        condition: ['creator', 'user']
      },
      PurchaseOrder: {
        condition: ['changes.user', 'user']
      },
      PurchaseOrderPrint: {
        condition: ['printedBy', 'cancelledBy']
      },
      QiResult: {
        condition: ['users'],
        update: ['creator', 'updater', 'inspector', 'nokOwner', 'leader', 'correctiveActions.who+']
      },
      Setting: {
        condition: ['updater']
      },
      Suggestion: {
        condition: ['finisher', 'observers.user', 'changes.user'],
        update: [
          'creator',
          'updater',
          'confirmer',
          'finisher',
          'suggestionOwners',
          'kaizenOwners',
          'owners',
          'observers.user',
          'changes.user'
        ]
      }
    };

    req.setTimeout(0);

    const userId = req.params.id;

    usersModule.info(`[anonymize] [${userId}] Started...`);

    step(
      function()
      {
        User.anonymize(userId, this.next());
      },
      function(err, user)
      {
        if (err)
        {
          return this.skip(err);
        }

        if (user)
        {
          app.broker.publish('users.edited', {
            user: userModule.createUserInfo(req.session.user, req),
            model: user
          });
        }

        anonymizeNextModel(userId, Object.keys(modelsToUpdate), modelsToUpdate, this.next());
      },
      function(err)
      {
        if (err)
        {
          usersModule.error(`[anonymize] [${userId}] ${err.message}`);
        }
        else
        {
          usersModule.info(`[anonymize] [${userId}] Finished!`);
        }

        res.sendStatus(204);
      }
    );
  }

  function anonymizeEvents(Event, userId, done)
  {
    const $set = {};
    const data = User.anonymizeData(userId);

    Object.keys(data).forEach(prop =>
    {
      $set[`data.model.${prop}`] = data[prop];
    });

    Event.collection.update(
      {type: /^users/, 'data.model._id': userId},
      {$set},
      done
    );
  }

  function anonymizeOpinionSurveys(OpinionSurvey, userId, done)
  {
    if (!app.opinionSurveys || !app.opinionSurveys.config)
    {
      return done();
    }

    fs.emptyDir(app.opinionSurveys.config.surveysPath, done);
  }

  function anonymizeProdLogEntries(ProdLogEntry, userId, done)
  {
    const conditions = {
      type: {$in: ['changeMaster', 'changeLeader', 'changeOperator']},
      'data.id': userId
    };
    const update = {$set: {
      'data.label': '?'
    }};

    ProdLogEntry.collection.update(conditions, update, done);
  }

  function anonymizeNextModel(userId, modelQueue, modelsToUpdate, done)
  {
    if (modelQueue.length === 0)
    {
      return done();
    }

    const modelName = modelQueue.shift();
    const {condition, update, custom} = modelsToUpdate[modelName];
    let Model = null;

    try
    {
      Model = mongoose.model(modelName);
    }
    catch (err)
    {
      return setImmediate(anonymizeNextModel, userId, modelQueue, modelsToUpdate, done);
    }

    const conditions = {$or: []};
    const updates = [];
    const fields = {};

    condition.forEach(prop =>
    {
      if (prop === 'users')
      {
        conditions.$or.push({users: userId});
      }
      else
      {
        conditions.$or.push({[`${prop.replace(/[+!]+/g, '')}.id`]: userId});

        if (!update)
        {
          updates.push(createAnonymizeUpdate(prop, userId));

          fields[prop.replace(/[+!]+/g, '').split('.')[0]] = 1;
        }
      }
    });

    (update || []).forEach(prop =>
    {
      updates.push(createAnonymizeUpdate(prop, userId));

      fields[prop.replace(/[+!]+/g, '').split('.')[0]] = 1;
    });

    usersModule.debug(`[anonymize] [${userId}] ${modelName}...`);

    step(
      function()
      {
        anonymizeNextBatch(Model, conditions, fields, updates, this.group());

        if (typeof custom === 'function')
        {
          custom(Model, userId, this.group());
        }
      },
      function(err)
      {
        if (err)
        {
          usersModule.warn(`[anonymize] [${userId}] Failed to anonymize: ${err.message}\n${JSON.stringify(conditions)}`);
        }

        setImmediate(anonymizeNextModel, userId, modelQueue, modelsToUpdate, done);
      }
    );
  }

  function createAnonymizeUpdate(prop, userId)
  {
    const path = prop.replace(/[+!]+/g, '').split('.');
    const modifier = prop.endsWith('!')
      ? '!'
      : prop.endsWith('+')
        ? '+'
        : '';
    const isList = modifier === '+' || path[0].endsWith('s');
    const isDirect = modifier === '!';

    return model =>
    {
      let o = model[path[0]];

      if (!o)
      {
        return;
      }

      if ((isList && !Array.isArray(o)) || (!isList && Array.isArray(o)))
      {
        return;
      }

      if (path.length > 1 && !isDirect)
      {
        o = o[path[1]];
      }

      if (!o)
      {
        return;
      }

      if (isList)
      {
        o.forEach(user =>
        {
          if ((user.id !== userId) && (user._id !== userId))
          {
            return;
          }

          if (user.label)
          {
            user.label = '?';
          }

          if (isDirect && user[path[1]])
          {
            user[path[1]] = '?';
          }
        });
      }
      else if (o.id === userId || o._id === userId)
      {
        if (o.label)
        {
          o.label = '?';
        }

        if (isDirect && o[path[1]])
        {
          o[path[1]] = '?';
        }
      }
    };
  }

  function anonymizeNextBatch(Model, conditions, fields, updates, done)
  {
    const cursor = Model.find(conditions, fields).lean().cursor({batchSize: 10});
    const complete = _.once(done);

    cursor.once('error', complete);
    cursor.once('end', complete);
    cursor.on('data', model =>
    {
      updates.forEach(update => update(model));

      Model.collection.update({_id: model._id}, {$set: model}, () => {});
    });
  }

  function hashPassword(req, res, next)
  {
    if (!_.isObject(req.body))
    {
      return next();
    }

    const password = req.body.password;

    if (!_.isString(password) || password.length === 0)
    {
      return next();
    }

    bcrypt.hash(password, 10, function(err, hash)
    {
      if (err)
      {
        return next(err);
      }

      req.body.passwordText = password;
      req.body.password = hash;

      next();
    });
  }
};
