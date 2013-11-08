define([
  'underscore',
  'jquery',
  'moment',
  'app/time',
  'app/controller',
  'app/user',
  'app/i18n',
  'app/viewport',
  'app/core/util',
  'app/core/View',
  'app/core/views/SvgUtilMixin',
  '../views/ControlsUtilMixin',
  'app/diagnostics/templates/reservoirs',
  'app/diagnostics/templates/pathEnding',
  'bootstrap-switch',
  'i18n!app/nls/diagnostics'
], function(
  _,
  $,
  moment,
  time,
  controller,
  user,
  t,
  viewport,
  util,
  View,
  SvgUtilMixin,
  ControlsUtilMixin,
  reservoirsTemplate,
  pathEndingTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.ReservoirsView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var ReservoirsView = View.extend({

    template: reservoirsTemplate,

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        _.each(changes, this.updateState, this);
      }
    },

    events: {
      'switch-change .diag-state-switch': function(e)
      {
        var $switch = this.$(e.target);

        this.toggleSwitchTag($switch.attr('data-tag'), $switch);
      }
    }

  });

  _.extend(ReservoirsView.prototype, SvgUtilMixin);
  _.extend(ReservoirsView.prototype, ControlsUtilMixin);

  ReservoirsView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('diag-reservoirs');

    /**
     * @private
     * @type {string}
     */
    this.tagPrefix = 'reservoirs';

    $(window).on('resize', this.adjustSize);
  };

  ReservoirsView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      renderPathEnding: pathEndingTemplate
    };
  };

  ReservoirsView.prototype.afterRender = function()
  {
    var view = this;

    this.$('[data-tag]').each(function()
    {
      var tagName = this.getAttribute('data-tag');

      view.updateState(controller.getValue(tagName), tagName);
    });

    this.$('.make-switch').bootstrapSwitch();

    this.adjustSize();
  };

  ReservoirsView.prototype.destroy = function()
  {
    this.$('.make-switch').bootstrapSwitch('destroy');

    $(window).off('resize', this.adjustSize);
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  ReservoirsView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case 'reservoirs.1.state':
      case 'reservoirs.2.state':
        this.$('.diag-state-switch[data-tag="' + tagName + '"]')
          .bootstrapSwitch('setState', newValue, true);
        this.toggleManualControls();

        var symbolSelector = '#' + this.idPrefix + '-reservoirs-' +
          (tagName === 'reservoirs.1.state' ? '1' : '2');

        this.toggleElement(symbolSelector, !newValue, 'el-disabled');
        break;

      case 'reservoirs.1.waterLevel':
        this.setTagValue(tagName, newValue);
        this.recalculateReservoirFillLevel(1);
        this.toggleReservoirExtremes(1);
        break;

      case 'reservoirs.2.waterLevel':
        this.setTagValue(tagName, newValue);
        this.recalculateReservoirFillLevel(2);
        this.toggleReservoirExtremes(2);
        break;

      case 'reservoirs.1.height':
        this.setReservoirExtremes(1, 'min');
        this.setReservoirExtremes(1, 'max');
        this.toggleReservoirExtremes(1);
        this.recalculateReservoirFillLevel(1);
        break;

      case 'reservoirs.2.height':
        this.setReservoirExtremes(2, 'min');
        this.setReservoirExtremes(2, 'max');
        this.toggleReservoirExtremes(2);
        this.recalculateReservoirFillLevel(2);
        break;

      case 'reservoirs.1.waterLevel.min':
        this.setReservoirExtremes(1, 'min');
        this.toggleReservoirExtremes(1);
        break;

      case 'reservoirs.1.waterLevel.max':
        this.setReservoirExtremes(1, 'max');
        this.toggleReservoirExtremes(1);
        break;

      case 'reservoirs.2.waterLevel.min':
        this.setReservoirExtremes(2, 'min');
        this.toggleReservoirExtremes(2);
        break;

      case 'reservoirs.2.waterLevel.max':
        this.setReservoirExtremes(2, 'max');
        this.toggleReservoirExtremes(2);
        break;

      case 'inputFlow':
      case 'washingFlow':
      case 'outputFlow':
        this.togglePaths();
        break;
    }
  };

  /**
   * @private
   */
  ReservoirsView.prototype.togglePaths = function()
  {
    var v = controller.getValue;
    var filterSet1Treating =
      v('filterSets.1.valves.1.status') && v('filterSets.1.valves.5.status');
    var filterSet2Treating =
      v('filterSets.2.valves.1.status') && v('filterSets.2.valves.5.status');
    var idPrefix = '#' + this.idPrefix;

    var input = v('inputFlow') > 0 && (filterSet1Treating || filterSet2Treating)
      ? 'cleanWater'
      : null;
    var output = v('washingFlow') > 0 || v('outputFlow') > 0
      ? 'cleanWater'
      : null;

    this.setPathEnding(idPrefix + '-input', input);
    this.setPath(idPrefix + '-reservoirs-v25-v15', input);
    this.setPathEnding(idPrefix + '-output', output);
    this.setPath(idPrefix + '-reservoirs-hydroSet', output);
  };

  /**
   * @private
   * @param {number} index
   */
  ReservoirsView.prototype.recalculateReservoirFillLevel = function(index)
  {
    var fillEl = this.el.querySelector(
      '#' + this.idPrefix + '-reservoirs-' + index + '-waterLevel-fill'
    );
    var capacityTag = 'reservoirs.' + index + '.height';
    var waterLevelTag = 'reservoirs.' + index + '.waterLevel';

    this.recalculateFillLevel(fillEl, capacityTag, waterLevelTag, false);
  };

  /**
   * @private
   * @param {number} index
   */
  ReservoirsView.prototype.toggleReservoirExtremes = function(index)
  {
    var waterLevelTag = 'reservoirs.' + index + '.waterLevel';
    var waterLevel = controller.getValue(waterLevelTag);

    this.toggleElement(
      '#' + this.idPrefix + '-reservoirs-' + index + '-min',
      waterLevel <= controller.getValue(waterLevelTag + '.min')
    );

    this.toggleElement(
      '#' + this.idPrefix + '-reservoirs-' + index + '-max',
      waterLevel >= controller.getValue(waterLevelTag + '.max')
    );
  };

  /**
   * @private
   * @param {number} index
   * @param {string} type
   */
  ReservoirsView.prototype.setReservoirExtremes = function(index, type)
  {
    var el = this.el.querySelector(
      '#' + this.idPrefix + '-reservoirs-' + index + '-' + type
    );
    var innerContainerEl =
      el.parentNode.querySelector('.el-reservoir-innerContainer');
    var positionTag = 'reservoirs.' + index + '.waterLevel.' + type;
    var capacityTag = 'reservoirs.' + index + '.height';

    this.setExtremes(el, innerContainerEl, positionTag, capacityTag);
  };

  /**
   * @private
   * @param {string} tagName
   * @param {number} value
   */
  ReservoirsView.prototype.setTagValue = function(tagName, value)
  {
    var tagEl = this.el.querySelector('[data-tag="' + tagName + '"]');

    if (!tagEl)
    {
      return;
    }

    tagEl.textContent = value == null ? '?.??' : value.toFixed(2);
  };

  return ReservoirsView;
});
