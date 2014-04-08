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
  'app/diagnostics/templates/uvLamp',
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
  uvLampTemplate,
  pathEndingTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.UvLampView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var UvLampView = View.extend({

    template: uvLampTemplate,

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
          'uvLamp.control', this.$('.diag-control-button')
        );
      },
      'switch-change .diag-state-switch': function(e)
      {
        this.toggleSwitchTag('uvLamp.state', this.$(e.target));
      },
      'switch-change .diag-mode-switch': function(e)
      {
        this.toggleSwitchTag('uvLamp.mode', this.$(e.target));
      }
    }

  });

  _.extend(UvLampView.prototype, SvgUtilMixin);
  _.extend(UvLampView.prototype, ControlsUtilMixin);

  UvLampView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('diag-uvLamp');

    /**
     * @private
     * @type {string}
     */
    this.tagPrefix = 'uvLamp';

    $(window).on('resize', this.adjustSize);
  };

  UvLampView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      renderPathEnding: pathEndingTemplate
    };
  };

  UvLampView.prototype.afterRender = function()
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

  UvLampView.prototype.destroy = function()
  {
    this.$('.make-switch').bootstrapSwitch('destroy');

    $(window).off('resize', this.adjustSize);
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  UvLampView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case 'uvLamp.switch':
        this.toggleSwitch('.diag-uvLamp-switch-image', 'uvLamp');
        break;

      case 'uvLamp.state':
        this.$('.diag-state-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        this.toggleElement('.diag-uvLamp-symbol', !newValue, 'el-disabled');
        break;

      case 'uvLamp.mode':
        this.$('.diag-mode-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        break;

      case 'uvLamp.control':
        this.toggleLedColor('.diag-uvLamp-control-image', 'uvLamp.control');
        this.toggleElement('.diag-uvLamp-symbol', newValue);
        break;

      case 'outputFlow':
        this.setTagValue(tagName, newValue);
        this.togglePaths();
        break;

      case 'outputFlow.total.forwards':
        this.setTagValue(tagName, newValue);
        break;
    }
  };

  /**
   * @private
   */
  UvLampView.prototype.setTagValue = function(tagName, value)
  {
    var valueEl = this.el.querySelector('text[data-tag="' + tagName + '"]');

    if (value == null)
    {
      value = '?';
    }
    else
    {
      value = value.toFixed(2);
    }

    valueEl.textContent = value + ' ' + valueEl.getAttribute('data-unit');
  };

  /**
   * @private
   */
  UvLampView.prototype.togglePaths = function()
  {
    var flow = controller.getValue('outputFlow') > 0;

    this.toggleElement('.el-path', flow, 'el-path-cleanWater');
    this.toggleElement(
      '.diag-path-ending-rl', flow, 'diag-path-ending-rl-cleanWater'
    );
    this.toggleElement(
      '.diag-path-ending-lr', flow, 'diag-path-ending-lr-cleanWater'
    );
  };

  return UvLampView;
});
