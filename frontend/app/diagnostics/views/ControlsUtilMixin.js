// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'jquery',
  'app/controller',
  'app/viewport',
  'app/i18n',
  'app/user',
  'i18n!app/nls/diagnostics',
  'i18n!app/nls/tags'
], function(
  _,
  $,
  controller,
  viewport,
  t,
  user
) {
  'use strict';

  return {

    /**
     * @param {jQuery} $led
     * @param {string} color
     */
    setLedColor: function($led, color)
    {
      $led.attr('src', '/assets/img/led.svg?color=' + color);

      if (window.chrome)
      {
        $led.css('display', 'inline-block');

        _.defer(function() { $led.css('display', 'inline'); });
      }
    },

    /**
     * @param {string} selector
     * @param {string} tagName
     */
    toggleLedColor: function(selector, tagName)
    {
      var $ledEl = this.$(selector);
      var onColor = $ledEl.attr('data-on-color') || 'green';
      var color = controller.getValue(tagName) ? onColor : 'grey';

      this.setLedColor($ledEl, color);
    },

    /**
     * @param {jQuery} $switch
     * @param {number} value
     */
    setSwitchValue: function($switch, value)
    {
      if (isNaN(value))
      {
        value = 0;
      }

      $switch.attr('src', '/assets/img/switch.svg?value=' + value);

      if (window.chrome)
      {
        $switch.css('display', 'inline-block');

        _.defer(function() { $switch.css('display', 'inline'); });
      }
    },

    /**
     * @param {string} tagName
     * @param {jQuery} $switchEl
     */
    toggleSwitchTag: function(tagName, $switchEl)
    {
      if ($switchEl.hasClass('loading'))
      {
        return;
      }

      var newState = $switchEl.bootstrapSwitch('status');

      if (newState === controller.getValue(tagName))
      {
        return;
      }

      $switchEl.addClass('loading');
      $switchEl.bootstrapSwitch('setActive', false);

      var view = this;
      var startTime = Date.now();

      controller.setValue(tagName, newState, function(err)
      {
        if (err)
        {
          $switchEl.bootstrapSwitch(
            'setState', controller.getValue(tagName) === true, true
          );
        }

        view.fakeDelay(startTime, 500, function()
        {
          $switchEl.removeClass('loading');

          if (_.isFunction(view.toggleManualControls))
          {
            view.toggleManualControls(tagName);
          }
        });
      });
    },

    /**
     * @param {string} tagName
     * @param {jQuery} $buttonEl
     */
    toggleControlTag: function(tagName, $buttonEl)
    {
      this.setButtonTagValue(tagName, !controller.getValue(tagName), $buttonEl);
    },

    /**
     * @param {string} tagName
     * @param {*} value
     * @param {jQuery} $buttonEl
     */
    setButtonTagValue: function(tagName, value, $buttonEl)
    {
      if ($buttonEl.hasClass('loading'))
      {
        return;
      }

      $buttonEl.addClass('loading');

      var view = this;
      var startTime = Date.now();

      controller.setValue(tagName, value, function(err)
      {
        if (err)
        {
          viewport.msg.show({
            time: 3000,
            type: 'error',
            text: t('diagnostics', 'TAG_WRITE_FAILED', {
              tag: t('tags', 'TAG:' + tagName),
              value: value,
              reason: t('diagnostics', err.code || err.message)
            })
          });
        }

        view.fakeDelay(startTime, 500, function()
        {
          $buttonEl.removeClass('loading');

          if (_.isFunction(view.toggleManualControls))
          {
            view.toggleManualControls(tagName);
          }
        });
      });
    },

    /**
     * @param {number} startTime
     * @param {number} diff
     * @param {function} func
     */
    fakeDelay: function(startTime, diff, func)
    {
      var timeDiff = Date.now() - startTime;
      var timerId = Math.random().toString();
      var timers = this.timers;

      if (timeDiff > diff)
      {
        func();
      }
      else
      {
        timers[timerId] = setTimeout(
          function()
          {
            delete timers[timerId];

            func();
          },
          diff - timeDiff
        );
      }
    },

    /**
     * @param {string} selector
     * @param {string} tagPrefix
     */
    toggleSwitch: function(selector, tagPrefix)
    {
      var $switchEl = this.$(selector);
      var value = 0;

      if (controller.getValue(tagPrefix + '.switch'))
      {
        value = 1;
      }
      else if (controller.getValue(tagPrefix + '.status'))
      {
        value = 2;
      }

      this.setSwitchValue($switchEl, value);
    },

    /**
     * @param {string} selector
     * @param {string|null} type
     */
    setPathEnding: function(selector, type)
    {
      var el = this.el.querySelector(selector);
      var dir = el.getAttribute('data-dir');

      el.style.fill =
        'url(#diag-path-ending-' + dir + (type ? ('-' + type) : '') + ')';
    },

    /**
     * @param {string} selector
     * @param {string|null} type
     */
    setPath: function(selector, type)
    {
      var el = this.el.querySelector(selector);
      var className = el.getAttribute('class').replace(/el-path-[a-zA-Z]+/, '');

      if (type)
      {
        el.setAttribute('class', className + ' ' + 'el-path-' + type);
      }
      else
      {
        el.setAttribute('class', className);
      }
    },

    toggleManualControls: _.debounce(function()
    {
      this.toggleSpecifiedManualControls(
        this.tagPrefix,
        this.$('.diag-state-switch'),
        this.$('.diag-mode-switch'),
        this.$('.diag-control-button')
      );
    }, 25),

    /**
     * @param {string} tagPrefix
     * @param {jQuery} $stateEl
     * @param {jQuery} $modeEl
     * @param {jQuery} $controlEl
     */
    toggleSpecifiedManualControls:
      function(tagPrefix, $stateEl, $modeEl, $controlEl)
    {
      var stateActive = true;
      var modeActive = true;
      var controlActive = false;

      if (!user.isAllowedTo('SETTINGS_MANAGE'))
      {
        stateActive = false;
        modeActive = false;
        controlActive = false;
      }
      else if (!controller.getValue(tagPrefix + '.state'))
      {
        modeActive = false;
        controlActive = false;
      }
      else if (!controller.getValue(tagPrefix + '.mode'))
      {
        controlActive = true;
      }

      if (!$stateEl.hasClass('loading'))
      {
        $stateEl.bootstrapSwitch('setActive', stateActive);
      }

      if (!$modeEl.hasClass('loading'))
      {
        $modeEl.bootstrapSwitch('setActive', modeActive);
      }

      $controlEl.attr('disabled', !controlActive);
    },

    adjustSize: _.debounce(function()
    {
      var containerHeight = window.innerHeight
        - ($('.page-header').outerHeight(true) || 0)
        - ($('.navbar').outerHeight(true) || 0)
        - ($('.ft').outerHeight(true) || 0)
        - 10;

      this.$('.diag-el-container').height(containerHeight);
    }, 50)

  };
});
