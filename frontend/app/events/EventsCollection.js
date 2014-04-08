// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
