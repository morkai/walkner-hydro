// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var _ = require('lodash');
var setUpEventsRoutes = require('./routes');

exports.DEFAULT_CONFIG = {
  mongooseId: 'mongoose',
  userId: 'user',
  expressId: 'express',
  collection: function(app) { return app.mongodb.db.collection('events'); },
  insertDelay: 1000,
  topics: ['events.**'],
  blacklist: [],
  print: []
};

exports.start = function startEventsModule(app, module)
{
  /**
   * @private
   * @type {Collection}
   */
  var eventsCollection = module.config.collection(app);

  /**
   * @private
   * @type {Array.<object>|null}
   */
  var pendingEvents = null;

  /**
   * @private
   * @type {number}
   */
  var lastFetchAllTypesTime = 0;

  /**
   * @private
   * @type {object|null}
   */
  var nextFetchAllTypesTimer = null;

  /**
   * @private
   * @type {number}
   */
  var lastInsertDelayTime = 0;

  module.types = {};

  module.getPendingEvents = function()
  {
    return pendingEvents || [];
  };

  module.insertEvents = insertEvents;

  app.onModuleReady(
    [
      module.config.mongooseId,
      module.config.userId,
      module.config.expressId
    ],
    setUpEventsRoutes.bind(null, app, module)
  );

  subscribe();

  app.broker.subscribe('app.started').setLimit(1).on('message', function()
  {
    fetchAllTypes();
    setInterval(checkBlockedInsert, 5000);
  });

  function fetchAllTypes()
  {
    var now = Date.now();
    var diff = now - lastFetchAllTypesTime;

    if (diff < 60000)
    {
      if (nextFetchAllTypesTimer === null)
      {
        nextFetchAllTypesTimer = setTimeout(fetchAllTypes, diff);
      }

      return;
    }

    eventsCollection.distinct('type', null, null, function(err, types)
    {
      if (err)
      {
        module.error("Failed to fetch event types: %s", err.message);
      }
      else
      {
        _.forEach(types, function(type)
        {
          module.types[type] = 1;
        });
      }

      lastFetchAllTypesTime = Date.now();
      nextFetchAllTypesTimer = null;
    });
  }

  function subscribe()
  {
    if (Array.isArray(module.config.topics))
    {
      var queueInfoEvent = queueEvent.bind(null, 'info');

      _.forEach(module.config.topics, function(topic)
      {
        app.broker.subscribe(topic, queueInfoEvent);
      });
    }
    else
    {
      _.forEach(module.config.topics, function(topics, severity)
      {
        var queueCustomSeverityEvent = queueEvent.bind(null, severity);

        _.forEach(topics, function(topic)
        {
          app.broker.subscribe(topic, queueCustomSeverityEvent);
        });
      });
    }

    _.forEach(module.config.print, function(topic)
    {
      app.broker.subscribe(topic, printMessage);
    });
  }

  function printMessage(message, topic)
  {
    module.debug("[%s]", topic, message);
  }

  function queueEvent(severity, data, topic)
  {
    if (topic === 'events.saved')
    {
      return fetchAllTypes();
    }

    if (module.config.blacklist.indexOf(topic) !== -1)
    {
      return;
    }

    var user = null;
    var userData = data.user;

    if (_.isObject(userData))
    {
      user = {
        _id: String(userData._id || userData.id),
        name: userData.lastName && userData.firstName
          ? (userData.lastName + ' ' + userData.firstName)
          : (userData.login || userData.label),
        login: userData.login || userData.label,
        ipAddress: userData.ipAddress || userData.ip
      };
    }

    if (!_.isObject(data))
    {
      data = {};
    }
    else
    {
      data = JSON.parse(JSON.stringify(data));
    }

    var type = topic.replace(/^events\./, '');

    if (_.isString(data.severity))
    {
      severity = data.severity;

      delete data.severity;
    }

    if (user !== null)
    {
      delete data.user;
    }

    var event = {
      type: type,
      severity: severity,
      time: Date.now(),
      user: user,
      data: data
    };

    if (pendingEvents === null)
    {
      pendingEvents = [];

      setTimeout(insertEvents, module.config.insertDelay);

      lastInsertDelayTime = event.time;
    }

    pendingEvents.push(event);

    module.types[type] = 1;
  }

  function insertEvents()
  {
    if (pendingEvents === null)
    {
      return;
    }

    var eventsToSave = pendingEvents;

    pendingEvents = null;

    eventsCollection.insert(eventsToSave, function(err)
    {
      if (err)
      {
        module.error(
          "Failed to save %d events: %s", eventsToSave.length, err.message
        );
      }
      else
      {
        app.broker.publish('events.saved', eventsToSave);
      }
    });
  }

  function checkBlockedInsert()
  {
    if (pendingEvents === null)
    {
      return;
    }

    if (Date.now() - lastInsertDelayTime > 3333)
    {
      module.warn("Blocked! Forcing insert of %d pending events!", pendingEvents.length);

      insertEvents();
    }
  }
};
