// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  '../core/Collection',
  './Alarm'
], function(
  Collection,
  Alarm
) {
  'use strict';

  /**
   * @name app.alarms.AlarmsCollection
   * @constructor
   * @extends {app.core.Collection}
   * @param {Array.<object>} [models]
   * @param {object} [options]
   */
  var AlarmsCollection = Collection.extend({

    url: '/alarms',

    clientUrl: '#alarms',

    model: Alarm,

    rqlQuery:
      'select(name,state,lastStateChangeTime,severity,stopConditionMode)'
        + '&sort(-state,-lastStateChangeTime)'
        + '&limit(20)'

  });

  return AlarmsCollection;
});
