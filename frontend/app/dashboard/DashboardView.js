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
