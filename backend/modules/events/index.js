'use strict';

var lodash = require('lodash');
var setUpEventsRoutes = require('./routes');

exports.DEFAULT_CONFIG = {
  mongooseId: 'mongoose',
  userId: 'user',
  expressId: 'express',
  collection: function(app) { return app.mongodb.db.collection('events'); },
  insertDelay: 1000,
  topics: ['events.**'],
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

  module.types = {};

  app.onModuleReady(
    [
      module.config.mongooseId,
      module.config.userId,
      module.config.expressId
    ],
    setUpEventsRoutes.bind(null, app, module)
  );

  fetchAllTypes();
  subscribe();

  function fetchAllTypes()
  {
    eventsCollection.distinct('type', null, null, function(err, types)
    {
      if (err)
      {
        module.error("Failed to fetch event types: %s", err.message);
      }
      else
      {
        types.forEach(function(type)
        {
          module.types[type] = 1;
        });
      }
    });
  }

  function subscribe()
  {
    if (Array.isArray(module.config.topics))
    {
      var queueInfoEvent = queueEvent.bind(null, 'info');

      module.config.topics.forEach(function(topic)
      {
        app.broker.subscribe(topic, queueInfoEvent);
      });
    }
    else
    {
      lodash.each(module.config.topics, function(topics, severity)
      {
        var queueCustomSeverityEvent = queueEvent.bind(null, severity);

        topics.forEach(function(topic)
        {
          app.broker.subscribe(topic, queueCustomSeverityEvent);
        });
      });
    }

    module.config.print.forEach(function(topic)
    {
      app.broker.subscribe(topic, printMessage);
    });

    app.broker.subscribe('events.saved', function(events)
    {
      if (Array.isArray(events))
      {
        events.forEach(function(event) { module.types[event.type] = 1; });
      }
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
      return;
    }

    if (!lodash.isObject(data))
    {
      data = {};
    }
    else
    {
      data = lodash.cloneDeep(data);
    }

    var type = topic.replace(/^events\./, '');
    var user = null;

    if (lodash.isString(data.severity))
    {
      severity = data.severity;

      delete data.severity;
    }

    if (lodash.isObject(data.user))
    {
      user = {
        _id: data.user._id,
        login: data.user.login,
        ipAddress: data.user.ipAddress
      };

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
    }

    pendingEvents.push(event);
  }

  function insertEvents()
  {
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
};
