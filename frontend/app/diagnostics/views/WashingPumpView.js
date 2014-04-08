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
  'app/diagnostics/templates/washingPump',
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
  washingPumpTemplate,
  pathEndingTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.WashingPumpView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var WashingPumpView = View.extend({

    template: washingPumpTemplate,

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
          this.tagPrefix + '.control', this.$('.diag-control-button')
        );
      },
      'switch-change .diag-state-switch': function(e)
      {
        this.toggleSwitchTag(this.tagPrefix + '.state', this.$(e.target));
      },
      'switch-change .diag-mode-switch': function(e)
      {
        this.toggleSwitchTag(this.tagPrefix + '.mode', this.$(e.target));
      }
    }

  });

  _.extend(WashingPumpView.prototype, SvgUtilMixin);
  _.extend(WashingPumpView.prototype, ControlsUtilMixin);

  WashingPumpView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('diag-washingPump');

    /**
     * @private
     * @type {string}
     */
    this.tagPrefix = 'washingPump';

    /**
     * @private
     * @type {function}
     */
    this.togglePaths = _.debounce(this.togglePaths.bind(this), 25);

    $(window).on('resize', this.adjustSize);
  };

  WashingPumpView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      renderPathEnding: pathEndingTemplate
    };
  };

  WashingPumpView.prototype.afterRender = function()
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

  WashingPumpView.prototype.destroy = function()
  {
    this.$('.make-switch').bootstrapSwitch('destroy');

    $(window).off('resize', this.adjustSize);
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  WashingPumpView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case 'washingPump.switch':
        this.toggleSwitch('.diag-washingPump-switch-image', 'washingPump');
        break;

      case 'washingPump.state':
        this.$('.diag-state-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        this.toggleElement(
          '.diag-washingPump-symbol', !newValue, 'el-disabled'
        );
        break;

      case 'washingPump.mode':
        this.$('.diag-mode-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        break;

      case 'washingPump.control':
        this.toggleLedColor(
          '.diag-washingPump-control-image', 'washingPump.control'
        );
        break;

      case 'washingPump.status':
        this.toggleLedColor(
          '.diag-washingPump-status-image', 'washingPump.status'
        );
        this.toggleSwitch('.diag-washingPump-switch-image', 'washingPump');
        this.toggleElement('.diag-washingPump-symbol', newValue);
        break;

      case 'washingPump.failure':
        this.toggleLedColor(
          '.diag-washingPump-failure-image', 'washingPump.failure'
        );
        break;

      case 'filterSets.1.valves.1.status':
      case 'filterSets.1.valves.3.status':
      case 'filterSets.1.valves.4.status':
      case 'filterSets.1.valves.5.status':
      case 'filterSets.2.valves.1.status':
      case 'filterSets.2.valves.3.status':
      case 'filterSets.2.valves.4.status':
      case 'filterSets.2.valves.5.status':
      case 'blower.status':
      case 'outputFlow':
      case 'inputFlow':
        this.togglePaths();
        break;

      case 'filterSets.1.valves.2.status':
      case 'filterSets.1.valves.6.status':
      case 'filterSets.2.valves.2.status':
      case 'filterSets.2.valves.6.status':
        this.toggleElement('[data-tag="' + tagName + '"]', newValue);
        this.togglePaths();
        break;

      case 'compressorPressure':
        this.toggleElement(
          '.diag-washingPump-air-path', newValue > 0, 'diag-path-ending-lr-air'
        );
        break;

      case 'washingFlow':
        this.setTagValue(tagName, newValue);
        this.togglePaths();
        break;

      case 'washingFlow.total.forwards':
        this.setTagValue(tagName, newValue);
        break;

      case 'reservoirs.1.state':
      case 'reservoirs.1.height':
      case 'reservoirs.1.waterLevel':
      case 'reservoirs.2.state':
      case 'reservoirs.2.height':
      case 'reservoirs.2.waterLevel':
        this.recalculateReservoirsFillLevel();
        break;
    }
  };

  /**
   * @private
   */
  WashingPumpView.prototype.setTagValue = function(tagName, value)
  {
    var valueEl = this.el.querySelector('[data-tag="' + tagName + '"]');

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
  WashingPumpView.prototype.togglePaths = function()
  {
    var pathColors1 = filterSetValvesHelpers.getPathColors(1);
    var pathColors2 = filterSetValvesHelpers.getPathColors(2);
    var washingFlow = controller.getValue('washingFlow');
    var outputFlow = controller.getValue('outputFlow');
    var pumpOut = null;
    var reservoirsIn = pathColors1.v5 || pathColors2.v5;
    var reservoirsOut = washingFlow > 0 || outputFlow > 0
      ? 'cleanWater'
      : null;

    if (filterSetValvesHelpers.isOpen(1, 6) && pathColors1.bot !== null)
    {
      pumpOut = pathColors1.bot;
    }

    if (filterSetValvesHelpers.isOpen(2, 6) && pathColors2.bot !== null)
    {
      pumpOut = pathColors2.bot;
    }

    var idPrefix = '#' + this.idPrefix;

    this.setPathEnding(idPrefix + '-reservoirs-in', reservoirsIn);
    this.setPath(idPrefix + '-reservoirs-out', reservoirsOut);
    this.setPathEnding(idPrefix + '-reservoirs-hydroSet', reservoirsOut);
    this.setPath(idPrefix + '-pump-out', pumpOut);
    this.setPathEnding(idPrefix + '-v12-left', pathColors1.top);
    this.setPathEnding(idPrefix + '-v22-left', pathColors2.top);
    this.setPathEnding(idPrefix + '-v12-right', pathColors1.settler);
    this.setPathEnding(idPrefix + '-v22-right', pathColors2.settler);
    this.setPathEnding(idPrefix + '-v16-left', pathColors1.bot);
    this.setPathEnding(idPrefix + '-v26-left', pathColors2.bot);
  };

  /**
   * @private
   */
  WashingPumpView.prototype.recalculateReservoirsFillLevel = function()
  {
    var fillEl = this.el.querySelector(
      '#' + this.idPrefix + '-reservoirs-waterLevel-fill'
    );
    var capacity = 0;
    var waterLevel = 0;

    for (var i = 1; i <= 2; ++i)
    {
      var tagPrefix = 'reservoirs.' + i;

      if (controller.getValue(tagPrefix + '.state'))
      {
        capacity += controller.getValue(tagPrefix + '.height') || 0;
        waterLevel += controller.getValue(tagPrefix + '.waterLevel') || 0;
      }
    }

    this.recalculateFillLevel(fillEl, capacity, waterLevel, false);
    this.setTagValue('reservoirs.waterLevel', waterLevel);
    this.setTagValue('reservoirs.height', capacity);
  };

  return WashingPumpView;
});
