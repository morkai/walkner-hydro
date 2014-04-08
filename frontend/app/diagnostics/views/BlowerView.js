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
  'app/core/views/SvgUtilMixin',
  '../views/ControlsUtilMixin',
  '../views/filterSetValvesHelpers',
  'app/diagnostics/templates/blower',
  'app/diagnostics/templates/pathEnding',
  'bootstrap-switch',
  'i18n!app/nls/diagnostics'
], function(
  _,
  $,
  controller,
  user,
  util,
  View,
  SvgUtilMixin,
  ControlsUtilMixin,
  filterSetValvesHelpers,
  blowerTemplate,
  pathEndingTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.BlowerView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var BlowerView = View.extend({

    template: blowerTemplate,

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
          'blower.control', this.$('.diag-control-button')
        );
      },
      'switch-change .diag-state-switch': function(e)
      {
        this.toggleSwitchTag('blower.state', this.$(e.target));
      },
      'switch-change .diag-mode-switch': function(e)
      {
        this.toggleSwitchTag('blower.mode', this.$(e.target));
      }
    }

  });

  _.extend(BlowerView.prototype, SvgUtilMixin);
  _.extend(BlowerView.prototype, ControlsUtilMixin);

  BlowerView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('diag-blower');

    /**
     * @private
     * @type {string}
     */
    this.tagPrefix = 'blower';

    /**
     * @private
     * @type {function}
     */
    this.togglePaths = _.debounce(this.togglePaths.bind(this), 25);

    $(window).on('resize', this.adjustSize);
  };

  BlowerView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      renderPathEnding: pathEndingTemplate
    };
  };

  BlowerView.prototype.afterRender = function()
  {
    var updateState = this.updateState.bind(this);

    this.$('[data-tag]').each(function()
    {
      var tagName = this.getAttribute('data-tag');

      updateState(controller.getValue(tagName), tagName);
    });

    this.$('.make-switch').bootstrapSwitch();

    this.adjustSize();
  };

  BlowerView.prototype.destroy = function()
  {
    this.$('.make-switch').bootstrapSwitch('destroy');

    $(window).off('resize', this.adjustSize);
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  BlowerView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case 'blower.switch':
        this.toggleSwitch('.diag-blower-switch-image', 'blower');
        break;

      case 'blower.state':
        this.$('.diag-state-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        this.toggleElement('.diag-blower-symbol', !newValue, 'el-disabled');
        break;

      case 'blower.mode':
        this.$('.diag-mode-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        break;

      case 'blower.control':
        this.toggleLedColor('.diag-blower-control-image', 'blower.control');
        break;

      case 'blower.status':
        this.toggleLedColor('.diag-blower-status-image', 'blower.status');
        this.toggleSwitch('.diag-blower-switch-image', 'blower');
        this.toggleElement('.diag-blower-path', newValue, 'el-path-air');
        this.toggleElement('.diag-blower-symbol', newValue);
        this.togglePaths();
        break;

      case 'blower.failure':
        this.toggleLedColor('.diag-blower-failure-image', 'blower.failure');
        break;

      case 'filterSets.1.valves.2.status':
      case 'filterSets.1.valves.4.status':
      case 'filterSets.2.valves.2.status':
      case 'filterSets.2.valves.4.status':
        this.toggleElement('[data-tag="' + tagName + '"]', newValue);
        this.togglePaths();
        break;

      case 'filterSets.1.valves.1.status':
      case 'filterSets.1.valves.6.status':
      case 'filterSets.2.valves.1.status':
      case 'filterSets.2.valves.6.status':
      case 'inputFlow':
      case 'washingFlow':
        this.togglePaths();
        break;

      case 'compressorPressure':
        this.toggleElement(
          '.diag-blower-air-path', newValue > 0, 'diag-path-ending-lr-air'
        );
        break;
    }
  };

  /**
   * @private
   */
  BlowerView.prototype.togglePaths = function()
  {
    var pathColors1 = filterSetValvesHelpers.getPathColors(1);
    var pathColors2 = filterSetValvesHelpers.getPathColors(2);

    this.setPathEnding('#' + this.idPrefix + '-v12-left', pathColors1.top);
    this.setPathEnding('#' + this.idPrefix + '-v12-right', pathColors1.settler);
    this.setPathEnding('#' + this.idPrefix + '-v14-left', pathColors1.bot);
    this.setPathEnding('#' + this.idPrefix + '-v22-left', pathColors2.top);
    this.setPathEnding('#' + this.idPrefix + '-v22-right', pathColors2.settler);
    this.setPathEnding('#' + this.idPrefix + '-v24-left', pathColors2.bot);
  };

  return BlowerView;
});
