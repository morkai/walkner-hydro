// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'jquery',
  'underscore',
  'app/i18n',
  'app/user',
  '../View',
  'app/core/templates/navbar',
  'i18n!app/nls/core'
], function(
  $,
  _,
  i18n,
  user,
  View,
  navbarTemplate
) {
  'use strict';

  var STATUS_SELECTOR = '.navbar-account-status';

  /**
   * @name app.core.views.NavbarView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var NavbarView = View.extend({

    template: navbarTemplate,

    topics: {
      'router.executing': function onRouterExecuting(message)
      {
        this.activateNavItem(this.getModuleNameFromPath(message.req.path));
      },
      'socket.connected': function onSocketConnected()
      {
        this.setConnectionStatus(true);
      },
      'socket.reconnected': function onSocketReconnected()
      {
        this.setConnectionStatus(true);
      },
      'socket.disconnected': function onSocketDisconnected()
      {
        this.setConnectionStatus(false);
      }
    },

    events: {
      'click .navbar-account-locale': function onLocaleClick(e)
      {
        e.preventDefault();

        this.changeLocale(e.currentTarget.getAttribute('data-locale'));
      }/*,
      'click .dropdown-submenu > a': function(e)
      {
        this.$(e.target).parent().addClass('open');

        return false;
      },
      'mouseleave .dropdown-submenu.open': function(e)
      {
        this.$(e.target).closest('.dropdown-submenu').removeClass('open');
      }*/
    }

  });

  NavbarView.DEFAULT_OPTIONS = {
    /**
     * @type {string}
     */
    activeItemClassName: 'active',
    /**
     * @type {string}
     */
    offlineStatusClassName: 'navbar-status-offline',
    /**
     * @type {string}
     */
    onlineStatusClassName: 'navbar-status-online'
  };

  NavbarView.prototype.initialize = function()
  {
    _.defaults(this.options, NavbarView.DEFAULT_OPTIONS);

    /**
     * @private
     * @type {string}
     */
    this.activeModuleName = '';

    /**
     * @private
     * @type {object.<string, jQuery>|null}
     */
    this.navItems = null;

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$activeNavItem = null;
  };

  NavbarView.prototype.beforeRender = function()
  {
    this.navItems = null;
    this.$activeNavItem = null;
  };

  NavbarView.prototype.afterRender = function()
  {
    this.selectActiveNavItem();
    this.setConnectionStatus(this.socket.isConnected());
    this.hideNotAllowedEntries();
  };

  NavbarView.prototype.serialize = function()
  {
    return {user: user};
  };

  /**
   * @param {string} moduleName
   */
  NavbarView.prototype.activateNavItem = function(moduleName)
  {
    if (moduleName === this.activeModuleName)
    {
      return;
    }

    this.activeModuleName = moduleName;

    this.selectActiveNavItem();
  };

  /**
   * @param {string} newLocale
   */
  NavbarView.prototype.changeLocale = function(newLocale)
  {
    i18n.reload(newLocale);
  };

  NavbarView.prototype.setConnectionStatus = function(status)
  {
    var $status = this.$(STATUS_SELECTOR);

    if (status)
    {
      $status
        .removeClass(this.options.offlineStatusClassName)
        .addClass(this.options.onlineStatusClassName);
    }
    else
    {
      $status
        .removeClass(this.options.onlineStatusClassName)
        .addClass(this.options.offlineStatusClassName);
    }
  };

  /**
   * @private
   * @param {string} path
   * @returns {string}
   */
  NavbarView.prototype.getModuleNameFromPath = function(path)
  {
    if (path[0] === '/')
    {
      path = path.substr(1);
    }

    if (path === '')
    {
      return '';
    }

    var matches = path.match(/^([a-z0-9][a-z0-9\-]*[a-z0-9]*)/);

    return matches ? matches[1] : null;
  };

  /**
   * @private
   */
  NavbarView.prototype.selectActiveNavItem = function()
  {
    if (!this.isRendered())
    {
      return;
    }

    if (this.navItems === null)
    {
      this.cacheNavItems();
    }

    var activeItemClassName = this.options.activeItemClassName;

    if (this.$activeNavItem !== null)
    {
      this.$activeNavItem.removeClass(activeItemClassName);
    }

    var $newActiveNavItem = this.navItems[this.activeModuleName];

    if (_.isUndefined($newActiveNavItem))
    {
      this.$activeNavItem = null;
    }
    else
    {
      $newActiveNavItem.addClass(activeItemClassName);

      this.$activeNavItem = $newActiveNavItem;
    }
  };

  /**
   * @private
   */
  NavbarView.prototype.cacheNavItems = function()
  {
    this.navItems = {};

    this.$('.nav > li').each(this.cacheNavItem.bind(this));
  };

  /**
   * @private
   * @param {number} i
   * @param {Element} navItemEl
   */
  NavbarView.prototype.cacheNavItem = function(i, navItemEl)
  {
    var $navItem = this.$(navItemEl);

    if ($navItem.hasClass(this.options.activeItemClassName))
    {
      this.$activeNavItem = $navItem;
    }

    var href = $navItem.find('a').attr('href');

    if (!href || href[0] !== '#')
    {
      return;
    }

    var moduleName = this.getModuleNameFromPath(href.substr(1));

    this.navItems[moduleName] = $navItem;
  };

  /**
   * @private
   */
  NavbarView.prototype.hideNotAllowedEntries = function()
  {
    var navbarView = this;

    this.$('[data-privilege]').each(function()
    {
      var $li = navbarView.$(this);
      var privilege = $li.attr('data-privilege');

      if (!user.isAllowedTo(privilege))
      {
        $li.remove();
      }
    });
  };

  return NavbarView;
});
