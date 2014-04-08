// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'jquery',
  'app/user',
  'app/socket',
  'app/controller',
  '../View',
  'app/core/templates/pageLayout',
  'app/core/templates/breakin'
], function(
  _,
  $,
  user,
  socket,
  controller,
  View,
  pageLayoutTemplate,
  breakinTemplate
) {
  'use strict';

  /**
   * @name app.core.views.PageLayout
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var PageLayout = View.extend({

    template: pageLayoutTemplate,

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        var breakinState = changes['breakin.state'];

        if (_.isBoolean(breakinState))
        {
          this.toggleBreakin(breakinState);
        }
      }
    },

    events: {
      'submit .breakin-form': function(e)
      {
        e.preventDefault();

        this.tryToStopAlarm();
      }
    }

  });

  PageLayout.prototype.initialize = function()
  {
    this.$breakinModal = null;

    this.model = {
      id: null,
      actions: [],
      breadcrumbs: []
    };

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$header = null;

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$breadcrumbs = null;

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$actions = null;
  };

  PageLayout.prototype.destroy = function()
  {
    if (this.$breakinModal !== null)
    {
      this.$breakinModal.empty().remove();
      this.$breakinModal = null;
    }

    this.$breadcrumbs = null;
    this.$actions = null;
  };

  PageLayout.prototype.afterRender = function()
  {
    this.$header = this.$('.page-header').first();
    this.$breadcrumbs = this.$('.page-breadcrumbs').first();
    this.$actions = this.$('.page-actions').first();

    this.changeTitle();
    this.renderBreadcrumbs();
    this.renderActions();

    if (this.model.id !== null)
    {
      this.setId(this.model.id);
    }

    this.timers.breakin = setTimeout(
      this.toggleBreakin.bind(this, !!controller.values['breakin.state']),
      10
    );
  };

  PageLayout.prototype.reset = function()
  {
    this.setId(null);

    if (this.$header)
    {
      this.$header.hide();
    }

    if (this.$breadcrumbs)
    {
      this.model.breadcrumbs = [];

      this.$breadcrumbs.empty();
    }

    if (this.$actions)
    {
      this.model.actions = [];

      this.$actions.empty();
    }

    this.removeView('.bd');
    this.changeTitle();
  };

  /**
   * @param {string} id
   * @returns {app.views.PageLayout}
   */
  PageLayout.prototype.setId = function(id)
  {
    if (this.isRendered())
    {
      this.$el.attr('data-id', id);
    }

    this.model.id = id;

    return this;
  };

  /**
   * @param {function|object|string|Array.<object|string>} breadcrumbs
   * @param {string|function} breadcrumbs.label
   * @param {string} [breadcrumbs.href]
   * @returns {app.views.PageLayout}
   */
  PageLayout.prototype.setBreadcrumbs = function(breadcrumbs)
  {
    if (typeof breadcrumbs === 'function')
    {
      breadcrumbs = breadcrumbs();
    }

    if (!Array.isArray(breadcrumbs))
    {
      breadcrumbs = [breadcrumbs];
    }

    this.model.breadcrumbs = breadcrumbs.map(function(breadcrumb)
    {
      var breadcrumbType = typeof breadcrumb;

      if (breadcrumbType === 'string' || breadcrumbType === 'function')
      {
        breadcrumb = {label: breadcrumb, href: null};
      }

      if (typeof breadcrumb.href === 'string' && breadcrumb.href[0] !== '#')
      {
        breadcrumb.href = '#' + breadcrumb.href;
      }

      return breadcrumb;
    });

    this.changeTitle();

    if (this.$breadcrumbs)
    {
      this.renderBreadcrumbs();
    }

    return this;
  };

  /**
   * @param {function|object|string|Array.<object|string>} actions
   * @param {string} actions.label
   * @param {string} [actions.type]
   * @param {string} [actions.icon]
   * @param {string} [actions.href]
   * @param {function} [actions.callback]
   * @returns {app.views.PageLayout}
   */
  PageLayout.prototype.setActions = function(actions)
  {
    if (typeof actions === 'function')
    {
      actions = actions();
    }

    if (!Array.isArray(actions))
    {
      actions = [actions];
    }

    this.model.actions = actions.map(this.prepareAction.bind(this));

    if (this.$actions)
    {
      this.renderActions();
    }

    return this;
  };

  /**
   * @private
   * @param action
   * @returns {*}
   */
  PageLayout.prototype.prepareAction = function(action)
  {
    if (action.prepared)
    {
      return action;
    }

    if (typeof action.href === 'string')
    {
      if (action.href[0] !== '#')
      {
        action.href = '#' + action.href;
      }
    }
    else
    {
      action.href = '#';
    }

    if (typeof action.icon === 'string')
    {
      action.icon = 'icon-' + action.icon.split(' ').join(' icon-');
    }

    if (typeof action.className !== 'string')
    {
      action.className = '';
    }

    action.className = 'btn'
      + (typeof action.type === 'string' ? ' btn-' + action.type : '')
      + ' ' + action.className;

    action.prepared = true;

    return action;
  };

  /**
   * @private
   */
  PageLayout.prototype.renderBreadcrumbs = function()
  {
    var breadcrumbs = this.model.breadcrumbs;
    var html = '';

    for (var i = 0, l = breadcrumbs.length; i < l; ++i)
    {
      var breadcrumb = breadcrumbs[i];

      html += '<li>';

      if (i === l - 1 || !breadcrumb.href)
      {
        html += breadcrumb.label;
      }
      else
      {
        html += '<a href="' + breadcrumb.href + '">'
          + breadcrumb.label + '</a>';
      }
    }

    this.$breadcrumbs.html(html);
    this.$header.show();
  };

  /**
   * @private
   */
  PageLayout.prototype.renderActions = function()
  {
    var actions = this.model.actions;
    var callbacks = {};
    var afterRender = {};
    var html = '';

    for (var i = 0, l = actions.length; i < l; ++i)
    {
      var action = actions[i];

      if (action.privileges
        && ((_.isFunction(action.privileges) && !action.privileges())
          || !user.isAllowedTo(action.privileges)))
      {
        continue;
      }

      if (typeof action.callback === 'function')
      {
        callbacks[i] = action.callback.bind(this);
      }

      if (typeof action.afterRender === 'function')
      {
        afterRender[i] = action.afterRender.bind(this);
      }

      html += '<li data-index="' + i + '">';

      if (typeof action.template === 'function')
      {
        html += action.template(action);
      }
      else
      {
        html +=
          '<a class="' + action.className + '" href="' + action.href + '">';

        if (typeof action.icon === 'string')
        {
          html += '<i class="' + action.icon + '"></i>';
        }

        html += '<span>' + action.label + '</span></a>';
      }
    }

    this.$actions.html(html);

    var $actions = this.$actions.find('li');

    Object.keys(callbacks).forEach(function(i)
    {
      $actions.filter('li[data-index="' + i + '"]').click(actions[i].callback);
    });

    Object.keys(afterRender).forEach(function(i)
    {
      afterRender[i]($actions.filter('li[data-index="' + i + '"]'), actions[i]);
    });

    this.$header.show();
  };

  /**
   * @private
   */
  PageLayout.prototype.changeTitle = function()
  {
    this.broker.publish(
      'page.titleChanged', _.pluck(this.model.breadcrumbs, 'label')
    );
  };

  /**
   * @private
   * @param {boolean} newState
   */
  PageLayout.prototype.toggleBreakin = function(newState)
  {
    if (newState)
    {
      this.$breakinModal = $(breakinTemplate({
        showCloseButton: !user.local,
        canStopAlarm: user.local && user.isAllowedTo('ALARMS_BREAKIN')
      }));

      this.$el.append(this.$breakinModal);

      this.$breakinModal.modal({
        backdrop: user.local ? 'static' : true,
        keyboard: !user.local,
        show: true
      });
    }
    else if (this.$breakinModal)
    {
      var view = this;

      this.$breakinModal.on('hidden', function()
      {
        if (view.$breakinModal)
        {
          view.$breakinModal.empty().remove();
          view.$breakinModal = null;
        }
      });
      this.$breakinModal.modal('hide');
    }
  };

  /**
   * @private
   */
  PageLayout.prototype.tryToStopAlarm = function()
  {
    var code = this.$('.breakin-code').val();
    var $inputs = this.$('.breakin-form input').attr('disabled', true);

    socket.emit('breakin.stopAlarm', code, function()
    {
      $inputs.attr('disabled', false);
    });
  };

  return PageLayout;
});
