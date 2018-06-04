// Part of <https://miracle.systems/p/walkner-utilio> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const step = require('h5.step');
const parseCondition = require('./parseCondition');

module.exports = function setUpAlarmsRoutes(app, alarmsModule)
{
  const express = app[alarmsModule.config.expressId];
  const auth = app[alarmsModule.config.userId].auth;
  const controller = app[alarmsModule.config.controllerId];
  const Alarm = app[alarmsModule.config.mongooseId].model('Alarm');

  const canView = auth('ALARMS:VIEW');
  const canManage = auth('ALARMS:MANAGE');
  const canAck = auth('ALARMS:ACK');

  express.get(
    '/alarms',
    canView,
    setUpCurrentActionProjection,
    express.crud.browseRoute.bind(null, app, Alarm)
  );

  express.post('/alarms', canManage, parseConditions, express.crud.addRoute.bind(null, app, Alarm));

  express.get('/alarms/:id', canView, express.crud.readRoute.bind(null, app, Alarm));

  express.put(
    '/alarms/:id',
    canManage,
    parseConditions,
    express.crud.editRoute.bind(null, app, Alarm)
  );

  express.post('/alarms/:id', canUpdate, updateAlarmRoute);

  express.delete('/alarms/:id', canManage, express.crud.deleteRoute.bind(null, app, Alarm));

  /**
   * @prvate
   * @param {Object} req
   * @param {Object} res
   * @param {function(?Error)} next
   */
  function setUpCurrentActionProjection(req, res, next)
  {
    const fields = req.rql.fields;

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
   * @param {Object} req
   * @param {Object} res
   * @param {function(?Error)} next
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
          parseCondition(controller.values, req.body.stopCondition, this.next());
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

  function canUpdate(req, res, next)
  {
    if (req.body.action === 'ack')
    {
      canAck(req, res, next);
    }
    else
    {
      canManage(req, res, next);
    }
  }

  /**
   * @private
   * @param {Object} req
   * @param {Object} res
   * @param {function(?Error)} next
   * @returns {undefined}
   */
  function updateAlarmRoute(req, res, next)
  {
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
            return res.sendStatus(404);
          }

          const user = _.isObject(req.session.user)
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
              res.sendStatus(204);
            }
          });
        });

      default:
        return next(express.createHttpError(`Unsupported action: ${req.body.action}`, 400, 'UNSUPPORTED_ACTION'));
    }
  }
};
