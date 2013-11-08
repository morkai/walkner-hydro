define([
  'underscore',
  'jquery',
  'app/controller',
  'app/user',
  'app/core/util',
  'app/core/View',
  'app/core/views/SvgUtilMixin',
  '../views/ControlsUtilMixin',
  'app/diagnostics/templates/inputPump',
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
  inputPumpTemplate,
  pathEndingTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.InputPumpView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var InputPumpView = View.extend({

    template: inputPumpTemplate,

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

  _.extend(InputPumpView.prototype, SvgUtilMixin);
  _.extend(InputPumpView.prototype, ControlsUtilMixin);

  InputPumpView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('diag-inputPump');

    /**
     * @private
     * @type {string}
     */
    this.tagPrefix = 'inputPumps.' + this.options.id;

    /**
     * @private
     * @type {number}
     */
    this.wellDepth = -1;

    /**
     * @private
     * @type {number}
     */
    this.wellHeight = -1;

    $(window).on('resize', this.adjustSize);
  };

  InputPumpView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      index: this.options.id,
      renderPathEnding: pathEndingTemplate
    };
  };

  InputPumpView.prototype.afterRender = function()
  {
    var outlineEl =
      this.el.getElementsByClassName('el-inputPump-well-outline')[0];

    this.wellHeight = outlineEl.getBBox().height;

    var updateState = this.updateState.bind(this);

    this.$('[data-tag]').each(function()
    {
      var tagName = this.getAttribute('data-tag');

      updateState(controller.getValue(tagName), tagName);
    });

    this.$('.make-switch').bootstrapSwitch();

    this.adjustSize();
  };

  InputPumpView.prototype.destroy = function()
  {
    this.$('.make-switch').bootstrapSwitch('destroy');

    $(window).off('resize', this.adjustSize);
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  InputPumpView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case this.tagPrefix + '.switch':
        this.toggleSwitch('.diag-inputPump-switch-image', this.tagPrefix);
        break;

      case this.tagPrefix + '.state':
        this.$('.diag-state-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        this.toggleElement('.diag-inputPump-symbol', !newValue, 'el-disabled');
        break;

      case this.tagPrefix + '.mode':
        this.$('.diag-mode-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        break;

      case this.tagPrefix + '.control':
        this.toggleLedColor('.diag-inputPump-control-image', tagName);
        break;

      case this.tagPrefix + '.status':
        this.toggleLedColor('.diag-inputPump-status-image', tagName);
        this.toggleSwitch('.diag-inputPump-switch-image', this.tagPrefix);
        this.toggleElement('.diag-inputPump-symbol', newValue);
        break;

      case this.tagPrefix + '.dryRunLed':
        this.toggleLedColor('.diag-inputPump-dryrun-image', tagName);
        break;

      case this.tagPrefix + '.failure':
        this.toggleLedColor('.diag-inputPump-failure-image', tagName);
        break;

      case this.tagPrefix + '.depth':
      case this.tagPrefix + '.depth.sensor':
      case this.tagPrefix + '.depth.offset':
        this.calculateWellDepth();
        this.adjustOffset();
        this.adjustSensor();
        this.adjustPump();
        this.adjustWaterLevel();
        break;

      case this.tagPrefix + '.waterLevel':
        this.adjustWaterLevel();
        break;

      case 'inputFlow':
        this.setPathEnding(
          '#' + this.idPrefix + '-inputFlow',
          newValue > 0 ? 'rawWater' : null
        );
        break;
    }
  };

  /**
   * @private
   */
  InputPumpView.prototype.calculateWellDepth = function()
  {
    this.wellDepth = 2
      + controller.getValue(this.tagPrefix + '.depth.offset')
      + Math.max(
        controller.getValue(this.tagPrefix + '.depth'),
        controller.getValue(this.tagPrefix + '.depth.sensor')
      );

    if (isNaN(this.wellDepth))
    {
      this.wellDepth = -1;
    }
  };

  /**
   * @private
   */
  InputPumpView.prototype.adjustOffset = function()
  {
    this.adjustElement(
      this.el.querySelector('#' + this.idPrefix + '-offset'),
      'depth.offset',
      0
    );
  };

  /**
   * @private
   */
  InputPumpView.prototype.adjustSensor = function()
  {
    this.adjustElement(
      this.el.querySelector('#' + this.idPrefix + '-sensor'),
      'depth.sensor',
      controller.getValue(this.tagPrefix + '.depth.offset')
    );
  };

  /**
   * @private
   */
  InputPumpView.prototype.adjustPump = function()
  {
    this.adjustElement(
      this.el.querySelector('#' + this.idPrefix + '-pump'),
      'depth',
      controller.getValue(this.tagPrefix + '.depth.offset')
    );
  };

  /**
   * @private
   */
  InputPumpView.prototype.adjustWaterLevel = function()
  {
    this.adjustElement(
      this.el.getElementsByClassName('el-inputPump-well-waterLevel')[0],
      'waterLevel',
      0
    );
  };

  /**
   * @private
   * @param {SVGElement} el
   * @param {string} tagSuffix
   * @param {number} offset
   */
  InputPumpView.prototype.adjustElement = function(el, tagSuffix, offset)
  {
    if (this.wellHeight === -1 || this.wellDepth === -1)
    {
      return;
    }

    var depth = offset + controller.getValue(this.tagPrefix + '.' + tagSuffix);
    var height = this.wellHeight * depth / this.wellDepth;

    if (el.tagName === 'rect')
    {
      el.setAttribute('height', height);
    }
    else
    {
      this.translateElement(el, this.getTranslateValue(el).x, height);
    }

    var guideEl = el.getAttribute('data-guide');

    if (guideEl == null)
    {
      guideEl = el.getElementsByClassName('el-guide')[0];
    }
    else
    {
      guideEl = this.el.querySelector(guideEl);

      this.translateElement(guideEl, this.getTranslateValue(guideEl).x, height);
    }

    this.adjustGuide(guideEl, height, depth.toFixed(2) + 'm');
  };

  /**
   * @private
   * @param {SVGElement} guideEl
   * @param {number} newY
   * @param {string} label
   */
  InputPumpView.prototype.adjustGuide = function(guideEl, newY, label)
  {
    if (guideEl == null)
    {
      return;
    }

    var textEl = guideEl.getElementsByTagName('text')[0];

    if (textEl != null)
    {
      textEl.setAttribute('y', newY / 2 * -1 + 5);
      textEl.textContent = newY === 0 ? '' : label;
    }

    var vEl = guideEl.getElementsByClassName('el-guide-v')[0];

    if (vEl == null)
    {
      return;
    }

    var lastSeg = vEl.pathSegList.getItem(vEl.pathSegList.numberOfItems - 1);

    if (lastSeg.pathSegTypeAsLetter !== 'v')
    {
      return;
    }

    lastSeg.y = -newY;
  };

  return InputPumpView;
});
