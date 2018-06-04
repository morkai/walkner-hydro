// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

module.exports = function setUpEventRoutes(app, eventsModule)
{
  const express = app[eventsModule.config.expressId];
  const auth = app[eventsModule.config.userId].auth;
  const Event = app[eventsModule.config.mongooseId].model('Event');

  const canView = auth('EVENTS:VIEW');

  express.get('/events', canView, express.crud.browseRoute.bind(null, app, Event));

  express.get('/events/types', canView, getTypesRoute);

  express.get('/events/pending', canView, getPendingRoute);

  express.post('/events/pending', auth('SUPER'), insertPendingRoute);

  /**
   * @private
   * @param {Object} req
   * @param {Object} res
   */
  function getTypesRoute(req, res)
  {
    const types = Object.keys(eventsModule.types);

    types.sort();

    res.send(types);
  }

  /**
   * @private
   * @param {Object} req
   * @param {Object} res
   */
  function getPendingRoute(req, res)
  {
    res.send(eventsModule.getPendingEvents());
  }

  /**
   * @private
   * @param {Object} req
   * @param {Object} res
   */
  function insertPendingRoute(req, res)
  {
    const beforeCount = eventsModule.getPendingEvents().length;

    eventsModule.insertEvents();

    const afterCount = eventsModule.getPendingEvents().length;

    res.send({
      beforeCount: beforeCount,
      afterCount: afterCount
    });
  }
};
