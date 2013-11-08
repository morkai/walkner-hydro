define([
  'app/core/Model'
], function(
  Model
) {
  'use strict';

  /**
   * @name app.events.Event
   * @constructor
   * @extends {app.core.Model}
   * @param {object} [attributes]
   */
  var Event = Model.extend({

    urlRoot: '/events',

    defaults: {
      time: 0,
      user: null,
      type: 'unknown',
      severity: 'info',
      data: null
    }

  });

  return Event;
});
