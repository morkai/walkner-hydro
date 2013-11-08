define([
  'app/core/Collection',
  './Event'
], function(
  Collection,
  Event
) {
  'use strict';

  /**
   * @name app.events.EventsCollection
   * @constructor
   * @extends {app.core.Collection}
   * @param {Array.<object>} [models]
   * @param {object} [options]
   */
  var EventsCollection = Collection.extend({

    url: '/events',

    clientUrl: '#events',

    model: Event,

    rqlQuery: 'select(type,severity,user,time,data)&sort(-time)&limit(25)'

  });

  return EventsCollection;
});
