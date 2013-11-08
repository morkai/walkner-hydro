define([
  'underscore',
  'jquery',
  'app/controller',
  'app/user',
  'app/time',
  'app/core/util',
  'app/core/View',
  'app/core/views/SvgUtilMixin',
  '../views/ControlsUtilMixin',
  'app/diagnostics/templates/outputPumps',
  'app/diagnostics/templates/pathEnding',
  'bootstrap-switch',
  'i18n!app/nls/diagnostics'
], function(
  _,
  $,
  controller,
  user,
  time,
  util,
  View,
  SvgUtilMixin,
  ControlsUtilMixin,
  outputPumpsTemplate,
  pathEndingTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.OutputPumpsView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var OutputPumpsView = View.extend({

    template: outputPumpsTemplate,

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        _.each(changes, this.updateState, this);
      }
    },

    events: {
      'click .diag-outputPumps-picker .btn': function()
      {
        _.defer(this.togglePumpControls.bind(this));
      },
      'click .diag-control-button': function(e)
      {
        var $button = this.$(e.target).closest('.diag-control-button');
        var tagName = $button.find('[data-tag]').attr('data-tag');

        this.toggleControlTag(tagName, $button);
      },
      'click .diag-outputPumps-control': function()
      {
        var $button = this.$('.diag-outputPumps-control');
        var tagName = 'outputPumps.control';

        this.toggleControlTag(tagName, $button);
      },
      'switch-change .diag-state-switch': function(e)
      {
        this.toggleSwitchTag(
          this.tagPrefix + '.' + this.selectedPump + '.state', this.$(e.target)
        );
      },
      'switch-change .diag-mode-switch': function(e)
      {
        this.toggleSwitchTag(
          this.tagPrefix + '.' + this.selectedPump + '.mode', this.$(e.target)
        );
      },
      'change .diag-outputPumps-presetRef-slider': function(e)
      {
        this.$('.diag-outputPumps-presetRef-input').val(e.target.value);
        this.setPresetRef();
      },
      'change .diag-outputPumps-presetRef-input': function(e)
      {
        this.$('.diag-outputPumps-presetRef-slider').val(e.target.value);
        this.setPresetRef();
      }
    }

  });

  _.extend(OutputPumpsView.prototype, SvgUtilMixin);
  _.extend(OutputPumpsView.prototype, ControlsUtilMixin);

  OutputPumpsView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('diag-outputPumps');

    /**
     * @private
     * @type {string}
     */
    this.tagPrefix = 'outputPumps';

    /**
     * @private
     * @type {number}
     */
    this.selectedPump = -1;

    /**
     * @private
     * @type {function}
     */
    this.togglePaths = _.debounce(this.togglePaths.bind(this), 25);

    $(window).on('resize', this.adjustSize);
  };

  OutputPumpsView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      renderPathEnding: pathEndingTemplate
    };
  };

  OutputPumpsView.prototype.afterRender = function()
  {
    var updateState = this.updateState.bind(this);

    this.$('[data-tag]').each(function()
    {
      var tagName = this.getAttribute('data-tag');

      updateState(controller.getValue(tagName), tagName);
    });

    this.$('.make-switch').bootstrapSwitch();

    this.adjustSize();

    this.$(
      '.diag-outputPumps-picker .btn[value="' + (this.options.id || 1) + '"]'
    ).click();
  };

  OutputPumpsView.prototype.destroy = function()
  {
    this.$('.make-switch').bootstrapSwitch('destroy');

    $(window).off('resize', this.adjustSize);
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  OutputPumpsView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    var pump;

    switch (tagName)
    {
      case 'outputPumps.1.switch':
      case 'outputPumps.2.switch':
      case 'outputPumps.3.switch':
        this.toggleSwitch(
          '.diag-outputPump-switch-image[data-tag="' + tagName + '"]',
          this.tagPrefix + '.' + tagName.split('.')[1]
        );
        break;

      case 'outputPumps.1.state':
      case 'outputPumps.2.state':
      case 'outputPumps.3.state':
        this.$('.diag-state-switch[data-tag="' + tagName + '"]')
          .bootstrapSwitch('setState', newValue, true);
        this.toggleManualControls(tagName);
        this.toggleElement(
          '.diag-outputPump-symbol[data-pump="' + tagName.split('.')[1] + '"]',
          !newValue,
          'el-disabled'
        );
        break;

      case 'outputPumps.1.mode':
      case 'outputPumps.2.mode':
      case 'outputPumps.3.mode':
        this.$('.diag-mode-switch[data-tag="' + tagName + '"]')
          .bootstrapSwitch('setState', newValue, true);
        this.toggleManualControls(tagName);
        break;

      case 'outputPumps.1.control.grid':
      case 'outputPumps.2.control.grid':
      case 'outputPumps.3.control.grid':
      case 'outputPumps.control':
        this.toggleLedColor(
          '.diag-outputPump-control-image[data-tag="' + tagName + '"]', tagName
        );
        break;

      case 'outputPumps.1.control.vfd':
      case 'outputPumps.2.control.vfd':
      case 'outputPumps.3.control.vfd':
        this.toggleLedColor(
          '.diag-outputPump-control-image[data-tag="' + tagName + '"]', tagName
        );
        this.toggleVfdManualControls();
        break;

      case 'outputPumps.1.status':
      case 'outputPumps.2.status':
      case 'outputPumps.3.status':
        pump = tagName.split('.')[1];

        this.toggleLedColor(
          '.diag-outputPump-status-image[data-tag="' + tagName + '"]', tagName
        );
        this.toggleSwitch(
          '.diag-outputPump-switch-image[data-tag="' + tagName + '"]',
          this.tagPrefix + '.' + pump
        );
        this.toggleElement(
          '.diag-outputPump-symbol[data-pump="' + pump + '"]', newValue
        );
        this.togglePaths();
        break;

      case 'outputPumps.1.failure':
      case 'outputPumps.2.failure':
      case 'outputPumps.3.failure':
        this.toggleLedColor(
          '.diag-outputPump-failure-image[data-tag="' + tagName + '"]', tagName
        );
        break;

      case 'outputPumps.dryRun':
        this.toggleLedColor('.diag-outputPumps-dryrun-image', tagName);
        break;

      case 'outputFlow':
        this.setTagValue(tagName, newValue);
        this.togglePaths();
        break;

      case 'outputFlow.total.forwards':
      case 'outputPressure':
      case 'outputPumps.current':
      case 'outputPumps.outputFrequency':
        this.setTagValue(tagName, newValue);
        break;

      case 'outputPumps.presetRef':
        this.$('.diag-outputPumps-presetRef-slider').val(newValue);
        this.$('.diag-outputPumps-presetRef-input').val(newValue);
        this.setTagValue(tagName, newValue);
        break;

      case 'outputPumps.1.workTime':
      case 'outputPumps.2.workTime':
      case 'outputPumps.3.workTime':
        this.setTagValue(tagName, time.toString(newValue));
        break;

      case 'reservoirs.1.state':
      case 'reservoirs.1.height':
      case 'reservoirs.1.waterLevel':
      case 'reservoirs.2.state':
      case 'reservoirs.2.height':
      case 'reservoirs.2.waterLevel':
        this.recalculateReservoirsFillLevel();
        break;

      case 'inputFlow':
      case 'washingFlow':
        this.togglePaths();
        break;

      case 'uvLamp.control':
        this.toggleElement('.el-uvLamp', newValue);
        break;
    }
  };

  /**
   * @private
   */
  OutputPumpsView.prototype.togglePumpControls = function()
  {
    var selectedPump = Number(this.$('.diag-outputPumps-picker .active').val());

    if (this.selectedPump === selectedPump)
    {
      return;
    }

    var $allPumpsControls =
      this.$('.diag-manual-controls [data-visible-to-pump]');

    $allPumpsControls.hide();

    var $selectedPumpControls = $allPumpsControls.filter(function()
    {
      return Number(this.getAttribute('data-visible-to-pump')) === selectedPump;
    });

    $selectedPumpControls.show();

    this.selectedPump = selectedPump;

    this.broker.publish('router.navigate', {
      url: '/diagnostics/output-pumps?id=' + selectedPump,
      trigger: false,
      replace: true
    });

    this.toggleVfdManualControls();
  };

  /**
   * @private
   */
  OutputPumpsView.prototype.setTagValue = function(tagName, value)
  {
    var valueEl = this.el.querySelector('tspan[data-tag="' + tagName + '"]');

    if (value == null)
    {
      value = '?';
    }
    else if (typeof value === 'number')
    {
      value = value.toFixed(2);
    }

    valueEl.textContent = value;
  };

  /**
   * @private
   */
  OutputPumpsView.prototype.setPresetRef = _.debounce(function()
  {
    if (!this.changingPresetRef)
    {
      controller.setValue(
        'outputPumps.presetRef',
        parseInt(this.$('.diag-outputPumps-presetRef-input').val(), 10)
      );
    }
  }, 500);

  /**
   * @private
   */
  OutputPumpsView.prototype.togglePaths = function()
  {
    var idPrefix = '#' + this.idPrefix + '-';
    var val = controller.getValue;
    var outputFlow = val('outputFlow') > 0;

    var reservoirsIn = val('inputFlow') > 0
      && (
        (val('filterSets.1.valves.1.status')
          && val('filterSets.1.valves.5.status'))
        || (val('filterSets.2.valves.1.status')
          && val('filterSets.2.valves.5.status'))
      );
    var hydroSet = val('washingFlow') > 0 || outputFlow ? 'cleanWater' : null;
    var pump1 = outputFlow && val('outputPumps.1.status') ? 'cleanWater' : null;
    var pump2 = outputFlow && val('outputPumps.2.status') ? 'cleanWater' : null;
    var pump3 = outputFlow && val('outputPumps.3.status') ? 'cleanWater' : null;
    var pumps = pump1 || pump2 || pump3 ? 'cleanWater' : null;

    this.setPathEnding(
      idPrefix + 'reservoirs-in', reservoirsIn ? 'cleanWater' : null
    );
    this.setPathEnding(idPrefix + 'washingPump', hydroSet);
    this.setPath(idPrefix + 'reservoirs-hydroSet', hydroSet);
    this.setPath(idPrefix + 'pump-1-out', pump1);
    this.setPath(idPrefix + 'pump-2-out', pump2);
    this.setPath(idPrefix + 'pump-3-out', pump3);
    this.setPath(idPrefix + 'pumps-out', pumps);
    this.setPathEnding(idPrefix + 'out', pumps);
  };

  /**
   * @private
   */
  OutputPumpsView.prototype.recalculateReservoirsFillLevel = function()
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

  /**
   * @private
   * @param {string} tagName
   */
  OutputPumpsView.prototype.toggleManualControls = function(tagName)
  {
    var pump = parseInt(tagName.split('.')[1], 10);

    if (isNaN(pump))
    {
      return;
    }

    var tagPrefix = 'outputPumps.' + pump;

    this.toggleSpecifiedManualControls(
      tagPrefix,
      this.$('.diag-state-switch[data-tag="' + tagPrefix + '.state"]'),
      this.$('.diag-mode-switch[data-tag="' + tagPrefix + '.mode"]'),
      this.$('.diag-control-button[data-pump=' + pump + ']')
    );

    this.toggleVfdManualControls();
  };

  /**
   * @private
   */
  OutputPumpsView.prototype.toggleVfdManualControls = function()
  {
    var $control = this.$('.diag-outputPumps-control');
    var $slider = this.$('.diag-outputPumps-presetRef-slider');
    var $input = this.$('.diag-outputPumps-presetRef-input');

    var vfdControlledPump = -1;

    for (var pump = 1; pump <= 3; ++pump)
    {
      if (controller.getValue('outputPumps.' + pump + '.control.vfd')
        && !controller.getValue('outputPumps.' + pump + '.mode'))
      {
        vfdControlledPump = pump;

        break;
      }
    }

    var disabled = vfdControlledPump !== this.selectedPump;

    $control.attr('disabled', disabled);
    $slider.attr('disabled', disabled);
    $input.attr('disabled', disabled);
  };

  return OutputPumpsView;
});
