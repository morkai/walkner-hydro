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
