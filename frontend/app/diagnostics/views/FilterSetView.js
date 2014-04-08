// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
  '../views/filterSetValvesHelpers',
  'app/diagnostics/templates/filterSet',
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
  filterSetValvesHelpers,
  filterSetTemplate,
  pathEndingTemplate
) {
  'use strict';

  /**
   * @name app.diagnostics.views.FilterSetView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var FilterSetView = View.extend({

    template: filterSetTemplate,

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        _.each(changes, this.updateState, this);
      }
    },

    events: {
      'click .diag-filterSet-valve-button': function(e)
      {
        var $button = this.$(e.target).closest('.diag-filterSet-valve-button');
        var controlTag = $button.attr('data-tag');

        this.toggleControlTag(controlTag, $button);
      },
      'click .diag-filterSet-washing-button': function(e)
      {
        this.startWashing(
          this.$(e.target).closest('.diag-filterSet-washing-button')
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

  _.extend(FilterSetView.prototype, SvgUtilMixin);
  _.extend(FilterSetView.prototype, ControlsUtilMixin);

  FilterSetView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('diag-filterSets');

    /**
     * @private
     * @type {string}
     */
    this.tagPrefix = 'filterSets.' + this.options.id;

    /**
     * @private
     * @type {string|null}
     */
    this.currentPhase = null;

    /**
     * @private
     * @type {function}
     */
    this.toggleManualControls =
      _.debounce(this.toggleManualControls.bind(this), 25);

    /**
     * @private
     * @type {function}
     */
    this.updateTimeSinceLastWash = this.updateTimeSinceLastWash.bind(this);

    $(window).on('resize', this.adjustSize);
  };

  FilterSetView.prototype.serialize = function()
  {
    return {
      index: this.options.id,
      idPrefix: this.idPrefix,
      renderPathEnding: pathEndingTemplate
    };
  };

  FilterSetView.prototype.afterRender = function()
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

  FilterSetView.prototype.destroy = function()
  {
    this.$('.make-switch').bootstrapSwitch('destroy');

    $(window).off('resize', this.adjustSize);
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  FilterSetView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case this.tagPrefix + '.state':
        this.$('.diag-state-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        this.toggleElement('.el-filterSet', !newValue, 'el-disabled');
        break;

      case this.tagPrefix + '.mode':
        this.$('.diag-mode-switch').bootstrapSwitch(
          'setState', newValue, true
        );
        this.toggleManualControls();
        break;

      case this.tagPrefix + '.currentPhase':
        this.changePhase(newValue);
        break;

      case this.tagPrefix + '.valves.1.status':
      case this.tagPrefix + '.valves.2.status':
      case this.tagPrefix + '.valves.3.status':
      case this.tagPrefix + '.valves.4.status':
      case this.tagPrefix + '.valves.5.status':
      case this.tagPrefix + '.valves.6.status':
        this.toggleElement('.el-valve[data-tag="' + tagName + '"]', newValue);
        this.togglePaths();
        break;

      case this.tagPrefix + '.valves.1.control':
      case this.tagPrefix + '.valves.2.control':
      case this.tagPrefix + '.valves.3.control':
      case this.tagPrefix + '.valves.4.control':
      case this.tagPrefix + '.valves.5.control':
      case this.tagPrefix + '.valves.6.control':
        this.toggleLedColor(
          '.diag-manual-button[data-tag="' + tagName + '"] img', tagName
        );
        break;

      case this.tagPrefix + '.flowSinceLastWash':
        this.$('[data-tag="' + tagName + '"]').text(
          newValue == null ? '?' : newValue.toFixed(1)
        );
        break;

      case this.tagPrefix + '.timeSinceLastWash':
        this.updateTimeSinceLastWash();
        break;

      case this.tagPrefix + '.lastWashTime':
        this.$('[data-tag="' + tagName + '"]').text(
          newValue == null
            ? '????-??-?? ??:??:??'
            : moment(newValue).format('YYYY-MM-DD HH:mm:ss')
        );
        break;

      case 'compressorPressure':
        this.toggleElement(
          '#' + this.idPrefix + '-pneumaticDistributor-v',
          newValue > 0,
          'el-path-air'
        );
        this.toggleElement(
          '#' + this.idPrefix + '-pneumaticDistributor-v-out',
          newValue > 0,
          'diag-path-ending-tb-air'
        );
        break;

      case 'blower.status':
      case 'inputFlow':
      case 'washingFlow':
        this.togglePaths();
        break;
    }
  };

  /**
   * @private
   */
  FilterSetView.prototype.toggleManualControls = function()
  {
    ControlsUtilMixin.toggleManualControls.call(this);

    var $valveButtons = this.$('.diag-filterSet-valve-button');
    var $washingButton = this.$('.diag-filterSet-washing-button');

    var valveButtonsActive = false;
    var washingButtonActive = this.currentPhase === 'treatment'
      || this.currentPhase === 'treatmentWait';

    if (!user.isAllowedTo('SETTINGS_MANAGE'))
    {
      washingButtonActive = false;
    }
    else if (!controller.getValue(this.tagPrefix + '.state'))
    {
      washingButtonActive = false;
    }
    else if (!controller.getValue(this.tagPrefix + '.mode'))
    {
      valveButtonsActive = true;
      washingButtonActive = false;
    }

    $valveButtons.attr('disabled', !valveButtonsActive);
    $washingButton.attr('disabled', !washingButtonActive);
  };

  /**
   * @private
   * @param {string} newPhase
   */
  FilterSetView.prototype.changePhase = function(newPhase)
  {
    if (this.currentPhase === newPhase)
    {
      return;
    }

    if (this.currentPhase !== null)
    {
      this.setLedColor(
        this.$('[data-phase="' + this.currentPhase + '"]'), 'grey'
      );
    }

    this.setLedColor(this.$('[data-phase="' + newPhase + '"]'), 'green');

    this.currentPhase = newPhase;

    this.updateTimeSinceLastWash(false);
    this.toggleManualControls();
  };

  /**
   * @private
   */
  FilterSetView.prototype.togglePaths = function()
  {
    var pathColors = filterSetValvesHelpers.getPathColors(this.options.id);
    var idPrefix = '#' + this.idPrefix;

    this.setPathEnding(idPrefix + '-v1-out', pathColors.v1);
    this.setPathEnding(idPrefix + '-v4-out', pathColors.v4);
    this.setPathEnding(idPrefix + '-v5-out', pathColors.v5);
    this.setPathEnding(idPrefix + '-v6-out', pathColors.v6);
    this.setPath(idPrefix + '-v1-v2', pathColors.top);
    this.setPath(idPrefix + '-settler-v', pathColors.settler);
    this.setPathEnding(idPrefix + '-settler-v-out', pathColors.settler);
    this.setPath(idPrefix + '-bottom', pathColors.bot);
  };

  /**
   * @private
   */
  FilterSetView.prototype.updateTimeSinceLastWash = function(timer)
  {
    var tagName = this.tagPrefix + '.timeSinceLastWash';
    var timeSinceLastWash = controller.getValue(tagName);

    if (this.currentPhase === 'treatment')
    {
      var lastPhaseChangeTime =
        controller.getValue(this.tagPrefix + '.lastPhaseChangeTime');

      timeSinceLastWash +=
        (Date.now() - (lastPhaseChangeTime + time.offset)) / 1000;
    }

    this.$('[data-tag="' + tagName + '"]').text(
      time.toString(timeSinceLastWash, true)
    );

    if (timer !== false && this.timers !== null)
    {
      this.timers.updateTimeSinceLastWash =
        setTimeout(this.updateTimeSinceLastWash, 1000);
    }
  };

  /**
   * @private
   * @returns {string|null}
   */
  FilterSetView.prototype.canWash = function()
  {
    if (!controller.getValue('reservoirs.1.state')
      && !controller.getValue('reservoirs.2.state'))
    {
      return 'RESERVOIRS';
    }

    if ((!controller.getValue('inputPumps.1.switch')
      || !controller.getValue('inputPumps.1.state')
      || !controller.getValue('inputPumps.1.mode')
      || controller.getValue('inputPumps.1.failure'))
      && (!controller.getValue('inputPumps.2.switch')
      || !controller.getValue('inputPumps.2.state')
      || !controller.getValue('inputPumps.2.mode')
      || controller.getValue('inputPumps.2.failure')))
    {
      return 'INPUT_PUMPS';
    }

    if (!controller.getValue('blower.switch')
      || !controller.getValue('blower.state')
      || !controller.getValue('blower.mode')
      || controller.getValue('blower.failure'))
    {
      return 'BLOWER';
    }

    if (!controller.getValue('washingPump.switch')
      || !controller.getValue('washingPump.state')
      || !controller.getValue('washingPump.mode')
      || controller.getValue('washingPump.failure'))
    {
      return 'WASHING_PUMP';
    }

    return null;
  };

  /**
   * @private
   * @param {jQuery} $buttonEl
   */
  FilterSetView.prototype.startWashing = function($buttonEl)
  {
    var reason = this.canWash();

    if (reason !== null)
    {
      return viewport.msg.show({
        type: 'warning',
        time: 3000,
        text: t('diagnostics', 'FILTER_SET_WASHING_ILLEGAL', {
          reason: t('diagnostics', 'FILTER_SET_WASHING_ILLEGAL:' + reason)
        })
      });
    }

    this.setButtonTagValue(
      this.tagPrefix + '.currentPhase',
      'washingWait',
      $buttonEl
    );
  };

  return FilterSetView;
});
