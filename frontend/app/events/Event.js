// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
