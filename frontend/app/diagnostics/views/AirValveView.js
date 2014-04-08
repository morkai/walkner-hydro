// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'jquery',
  'app/controller',
  'app/user',
  'app/core/util',
  'app/core/View',
  '../views/ControlsUtilMixin',
  'app/diagnostics/templates/airValve',
  'bootstrap-switch',
  'i18n!app/nls/diagnostics'
], function(
  _,
  $,
  controller,
  user,
  util,
  View,
  ControlsUtilMixin,
  airValveTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.AirValveView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var AirValveView = View.extend({

    template: airValveTemplate,

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        _.each(changes, this.updateState, this);
      }
    },

    events: {
      'click .diag-control-button': function()
      {
        this.toggleControlTag(
          'airValve.control', this.$('.diag-control-button')
        );
      },
      'switch-change .diag-state-switch': function(e)
      {
        this.toggleSwitchTag('airValve.state', this.$(e.target));
      },
      'switch-change .diag-mode-switch': function(e)
      {
        this.toggleSwitchTag('airValve.mode', this.$(e.target));
      }
    }

  });

  _.extend(AirValveView.prototype, ControlsUtilMixin);

  AirValveView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.tagPrefix = 'airValve';
  };

  AirValveView.prototype.afterRender = function()
  {
    var updateState = this.updateState.bind(this);

    this.$('[data-tag]').each(function()
    {
      var tagName = this.getAttribute('data-tag');

      updateState(controller.values[tagName], tagName);
    });

    this.$('.make-switch').bootstrapSwitch();
  };

  AirValveView.prototype.destroy = function()
  {
    this.$('.make-switch').bootstrapSwitch('destroy');
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  AirValveView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case 'airValve.switch':
        this.toggleSwitch('.diag-air-valve-switch-image', 'airValve');
        break;

      case 'airValve.state':
        this.$('.diag-state-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        break;

      case 'airValve.mode':
        this.$('.diag-mode-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        break;

      case 'airValve.control':
        this.toggleLedColor(
          '.diag-air-valve-control-image', 'airValve.control'
        );
        break;

      case 'airValve.status':
        this.toggleLedColor('.diag-air-valve-status-image', 'airValve.status');
        this.toggleSwitch('.diag-air-valve-switch-image', 'airValve');
        break;
    }
  };

  return AirValveView;
});
