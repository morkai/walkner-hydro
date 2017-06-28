// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

module.exports = function setUpEventRoutes(app, eventsModule)
{
  var express = app[eventsModule.config.expressId];
  var auth = app[eventsModule.config.userId].auth;
  var Event = app[eventsModule.config.mongooseId].model('Event');

  var canView = auth('EVENTS:VIEW');

  express.get('/events', canView, express.crud.browseRoute.bind(null, app, Event));

  express.get('/events/types', canView, getTypesRoute);

  express.get('/events/pending', canView, getPendingRoute);

  express.post('/events/pending', auth('SUPER'), insertPendingRoute);

  /**
   * @private
   * @param {object} req
   * @param {object} res
   */
  function getTypesRoute(req, res)
  {
    var types = Object.keys(eventsModule.types);

    types.sort();

    res.send(types);
  }

  /**
   * @private
   * @param {object} req
   * @param {object} res
   */
  function getPendingRoute(req, res)
  {
    res.send(eventsModule.getPendingEvents());
  }

  /**
   * @private
   * @param {object} req
   * @param {object} res
   */
  function insertPendingRoute(req, res)
  {
    var beforeCount = eventsModule.getPendingEvents().length;

    eventsModule.insertEvents();

    var afterCount = eventsModule.getPendingEvents().length;

    res.send({
      beforeCount: beforeCount,
      afterCount: afterCount
    });
  }
};
