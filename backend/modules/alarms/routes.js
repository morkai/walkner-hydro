// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var lodash = require('lodash');
var step = require('h5.step');
var crud = require('../express/crud');
var parseCondition = require('./parseCondition');

module.exports = function setUpAlarmsRoutes(app, alarmsModule)
{
  var express = app[alarmsModule.config.expressId];
  var auth = app[alarmsModule.config.userId].auth;
  var controller = app[alarmsModule.config.controllerId];
  var Alarm = app[alarmsModule.config.mongooseId].model('Alarm');

  var canView = auth('ALARMS_VIEW');
  var canManage = auth('ALARMS_MANAGE');

  express.get(
    '/alarms',
    canView,
    setUpCurrentActionProjection,
    crud.browseRoute.bind(null, app, Alarm)
  );

  express.post(
    '/alarms', canManage, parseConditions, crud.addRoute.bind(null, app, Alarm)
  );

  express.get('/alarms/:id', canView, crud.readRoute.bind(null, app, Alarm));

  express.put(
    '/alarms/:id',
    canManage,
    parseConditions,
    crud.editRoute.bind(null, app, Alarm)
  );

  express.post('/alarms/:id', canManage, updateAlarmRoute);

  express.delete('/alarms/:id', canManage, crud.deleteRoute.bind(null, app, Alarm));

  /**
   * @prvate
   * @param {object} req
   * @param {object} res
   * @param {function(Error|null)} next
   */
  function setUpCurrentActionProjection(req, res, next)
  {
    var fields = req.rql.fields;

    if (fields.severity || fields.actionIndex)
    {
      if (!fields.lastStateChangeTime)
      {
        fields.lastStateChangeTime = true;
      }

      if (!fields.startActions)
      {
        if (!fields['startActions.severity'])
        {
          fields['startActions.severity'] = true;
        }

        if (!fields['startActions.delay'])
        {
          fields['startActions.delay'] = true;
        }
      }
    }

    next();
  }

  /**
   * @private
   * @param {object} req
   * @param {object} res
   * @param {function(Error|null)} next
   */
  function parseConditions(req, res, next)
  {
    step(
      function parseStartConditionStep()
      {
        parseCondition(controller.values, req.body.startCondition, this.next());
      },
      function handleStartFunctionStep(err, code, tags)
      {
        if (err)
        {
          return this.done(next, err);
        }

        req.body.startConditionTags = tags;
        req.body.startFunction = code;
      },
      function parseStopConditionStep()
      {

        if (req.body.stopConditionMode === Alarm.StopConditionMode.SPECIFIED)
        {
          parseCondition(
            controller.values, req.body.stopCondition, this.next()
          );
        }
        else
        {
          req.body.stopCondition = '';
          req.body.stopConditionTags = [];
          req.body.stopFunction = '';
        }
      },
      function handleStopFunctionStep(err, code, tags)
      {
        if (err)
        {
          return this.done(next, err);
        }

        req.body.stopConditionTags = tags;
        req.body.stopFunction = code;
      },
      next
    );
  }

  function updateAlarmRoute(req, res, next)
  {
    /*jshint -W015*/

    switch (req.body.action)
    {
      case 'ack':
      case 'run':
      case 'stop':
        return Alarm.findById(req.params.id, {}, function(err, alarm)
        {
          if (err)
          {
            return next(err);
          }

          if (alarm === null)
          {
            return res.send(404);
          }

          var user = lodash.isObject(req.session.user)
            ? req.session.user
            : null;

          alarmsModule[req.body.action](alarm.id, user, function(err)
          {
            if (err)
            {
              next(err);
            }
            else
            {
              res.send(204);
            }
          });
        });

      default:
        return res.send(400, {
          error: {
            message: 'Unsupported action: ' + req.body.action,
            code: 'UNSUPPORTED_ACTION'
          }
        });
    }
  }
};
