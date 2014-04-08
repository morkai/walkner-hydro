// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  '../core/View',
  'app/dashboard/templates/dashboard'
], function(
  View,
  dashboardTemplate
) {
  'use strict';

  /**
   * @name app.dashboard.DashboardView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var DashboardView = View.extend({

    template: dashboardTemplate

  });

  DashboardView.prototype.initialize = function()
  {
    this.render();
  };

  DashboardView.prototype.serialize = function()
  {
    return {

    };
  };

  return DashboardView;
});
