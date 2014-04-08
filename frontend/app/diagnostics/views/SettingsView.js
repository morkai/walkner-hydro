// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'jquery',
  'underscore',
  'app/controller',
  'app/i18n',
  'app/core/View',
  'i18n!app/nls/diagnostics'
], function(
  $,
  _,
  controller,
  i18n,
  View
) {
  'use strict';

  /**
   * @name app.diagnostics.views.SettingsView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var SettingsView = View.extend({

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        _.each(changes, this.updateState, this);
      }
    },

    events: {
      'change input': function(e)
      {
        var tagName = e.target.name;

        if (_.isUndefined(controller.values[tagName]))
        {
          return;
        }

        var value = parseFloat(e.target.value);

        if (value === controller.values[tagName])
        {
          return;
        }

        this.setSettingValue(tagName, value);
      }
    }

  });

  SettingsView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {function}
     */
    this.saveSettings = _.debounce(this.saveSettings.bind(this), 250);

    /**
     * @private
     * @type {object}
     */
    this.pendingChanges = {};
  };

  SettingsView.prototype.destroy = function()
  {
    this.saveSettings();
  };

  SettingsView.prototype.afterRender = function()
  {
    var view = this;

    this.$('[name]').each(function()
    {
      view.updateState(controller.getValue(this.name), this.name);

      var helpKey = 'SETTINGS:' + this.name + ':HELP';

      if (i18n.has('diagnostics', helpKey))
      {
        var $input = $(this);
        var $container = $input.closest('.input-append, .input-prepend');

        $('<span class="help-block"></span>')
          .html(i18n.translate('diagnostics', helpKey))
          .insertAfter($container.length ? $container : $input);

      }
    });
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  SettingsView.prototype.updateState = function(newValue, tagName)
  {
    this.$('input[name="' + tagName + '"]').val(newValue);
  };

  /**
   * @private
   * @param {string} tagName
   * @param {*} newValue
   */
  SettingsView.prototype.setSettingValue = function(tagName, newValue)
  {
    this.pendingChanges[tagName] = newValue;
    this.saveSettings();
  };

  /**
   * @private
   */
  SettingsView.prototype.saveSettings = function()
  {
    _.each(this.pendingChanges, function(value, tagName)
    {
      controller.setValue(tagName, value);
    });

    this.pendingChanges = {};
  };

  return SettingsView;
});
