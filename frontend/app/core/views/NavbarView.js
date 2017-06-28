// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'underscore',
  'app/i18n',
  'app/user',
  'app/time',
  '../View',
  'app/core/templates/navbar'
], function(
  _,
  t,
  user,
  time,
  View,
  navbarTemplate
) {
  'use strict';

  /**
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
        this.setConnectionStatus('online');
      },
      'socket.connecting': function onSocketConnecting()
      {
        this.setConnectionStatus('connecting');
      },
      'socket.connectFailed': function onSocketConnectFailed()
      {
        this.setConnectionStatus('offline');
      },
      'socket.disconnected': function onSocketDisconnected()
      {
        this.setConnectionStatus('offline');
      }
    },

    events: {
      'click .disabled a': function onDisabledEntryClick(e)
      {
        e.preventDefault();
      },
      'click .navbar-account-locale': function onLocaleClick(e)
      {
        e.preventDefault();

        this.changeLocale(e.currentTarget.getAttribute('data-locale'));
      },
      'click .navbar-account-logIn': function onLogInClick(e)
      {
        e.preventDefault();

        this.trigger('logIn');
      },
      'click .navbar-account-logOut': function onLogOutClick(e)
      {
        e.preventDefault();

        this.trigger('logOut');
      },
      'click .navbar-feedback': function onFeedbackClick(e)
      {
        e.preventDefault();

        e.target.disabled = true;

        this.trigger('feedback', function()
        {
          e.target.disabled = false;
        });
      },
      'mouseup .btn[data-href]': function(e)
      {
        if (e.button === 2)
        {
          return;
        }

        var href = e.currentTarget.dataset.href;

        if (e.ctrlKey || e.button === 1)
        {
          window.open(href);
        }
        else
        {
          window.location.href = href;
        }

        document.body.click();

        return false;
      }
    }

  });

  NavbarView.DEFAULT_OPTIONS = {
    /**
     * @type {string}
     */
    currentPath: '/',
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
    onlineStatusClassName: 'navbar-status-online',
    /**
     * @type {string}
     */
    connectingStatusClassName: 'navbar-status-connecting',
    /**
     * @type {object.<string, boolean>}
     */
    loadedModules: {}
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

    /**
     * @private
     * @type {string}
     */
    this.lastSearchPhrase = '';

    this.activateNavItem(this.getModuleNameFromPath(this.options.currentPath));
  };

  NavbarView.prototype.beforeRender = function()
  {
    this.navItems = null;
    this.$activeNavItem = null;
  };

  NavbarView.prototype.afterRender = function()
  {
    this.selectActiveNavItem();
    this.setConnectionStatus(this.socket.isConnected() ? 'online' : 'offline');
    this.hideNotAllowedEntries();
    this.hideEmptyEntries();
  };

  NavbarView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      user: user
    };
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
    t.reload(newLocale);
  };

  NavbarView.prototype.setConnectionStatus = function(status)
  {
    if (!this.isRendered())
    {
      return;
    }

    var $status = this.$('.navbar-account-status');

    $status
      .removeClass(this.options.offlineStatusClassName)
      .removeClass(this.options.onlineStatusClassName)
      .removeClass(this.options.connectingStatusClassName);

    $status.addClass(this.options[status + 'StatusClassName']);

    this.toggleConnectionStatusEntries(status === 'online');
  };

  /**
   * @private
   * @param {HTMLLIElement} liEl
   * @param {boolean} useAnchor
   * @param {boolean} [clientModule]
   * @returns {string|null}
   */
  NavbarView.prototype.getModuleNameFromLi = function(liEl, useAnchor, clientModule)
  {
    var module = liEl.dataset[clientModule ? 'clientModule' : 'module'];

    if (module === undefined && !useAnchor)
    {
      return null;
    }

    if (module)
    {
      return module;
    }

    var aEl = liEl.querySelector('a');

    if (!aEl)
    {
      return null;
    }

    var href = aEl.getAttribute('href');

    if (!href)
    {
      return null;
    }

    return this.getModuleNameFromPath(href);
  };

  /**
   * @private
   * @param {string} path
   * @returns {string}
   */
  NavbarView.prototype.getModuleNameFromPath = function(path)
  {
    if (path[0] === '/' || path[0] === '#')
    {
      path = path.substr(1);
    }

    if (path === '')
    {
      return '';
    }

    var matches = path.match(/^([a-z0-9][a-z0-9\-]*[a-z0-9]*)/i);

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

    if (href && href[0] === '#')
    {
      var moduleName = this.getModuleNameFromLi($navItem[0], true, true);

      this.navItems[moduleName] = $navItem;
    }
    else if ($navItem.hasClass('dropdown'))
    {
      var view = this;

      $navItem.find('.dropdown-menu > li').each(function()
      {
        var moduleName = view.getModuleNameFromLi(this, true, true);

        view.navItems[moduleName] = $navItem;
      });
    }
  };

  /**
   * @private
   */
  NavbarView.prototype.hideNotAllowedEntries = function()
  {
    var navbarView = this;
    var userLoggedIn = user.isLoggedIn();
    var dropdownHeaders = [];
    var dividers = [];

    this.$('.navbar-nav > li').each(function()
    {
      var $li = navbarView.$(this);

      if (!checkSpecial($li))
      {
        $li.toggle(isEntryVisible($li) && hideChildEntries($li));
      }
    });

    dropdownHeaders.forEach(function($li)
    {
      $li.toggle(navbarView.hasVisibleSiblings($li, 'next'));
    });

    dividers.forEach(function($li)
    {
      $li.toggle(navbarView.hasVisibleSiblings($li, 'prev') && navbarView.hasVisibleSiblings($li, 'next'));
    });

    this.$('.btn[data-privilege]').each(function()
    {
      this.style.display = user.isAllowedTo.apply(user, this.dataset.privilege.split(' ')) ? '' : 'none';
    });

    function hideChildEntries($parentLi)
    {
      if (!$parentLi.hasClass('dropdown'))
      {
        return true;
      }

      var anyVisible = true;

      $parentLi.find('> .dropdown-menu > li').each(function()
      {
        var $li = $parentLi.find(this);

        if (!checkSpecial($li))
        {
          var entryVisible = isEntryVisible($li) && hideChildEntries($li);

          $li.toggle(entryVisible);

          anyVisible = anyVisible || entryVisible;
        }
      });

      return anyVisible;
    }

    function checkSpecial($li)
    {
      if ($li.hasClass('divider'))
      {
        dividers.push($li);

        return true;
      }

      if ($li.hasClass('dropdown-header'))
      {
        dropdownHeaders.push($li);

        return true;
      }

      return false;
    }

    function isEntryVisible($li)
    {
      var loggedIn = $li.attr('data-loggedin');

      if (typeof loggedIn === 'string')
      {
        loggedIn = loggedIn !== '0';

        if (loggedIn !== userLoggedIn)
        {
          return false;
        }
      }

      var moduleName = navbarView.getModuleNameFromLi($li[0], false);

      if (moduleName !== null
        && $li.attr('data-no-module') === undefined
        && !navbarView.options.loadedModules[moduleName])
      {
        return false;
      }

      var privilege = $li.attr('data-privilege');

      return privilege === undefined || user.isAllowedTo.apply(user, privilege.split(' '));
    }
  };

  /**
   * @private
   * @param {jQuery} $li
   * @param {string} dir
   * @returns {boolean}
   */
  NavbarView.prototype.hasVisibleSiblings = function($li, dir)
  {
    var $siblings = $li[dir + 'All']().filter(function() { return this.style.display !== 'none'; });

    if (!$siblings.length)
    {
      return false;
    }

    var $sibling = $siblings.first();

    return !$sibling.hasClass('divider');
  };

  /**
   * @private
   */
  NavbarView.prototype.hideEmptyEntries = function()
  {
    var navbarView = this;

    this.$('.dropdown > .dropdown-menu').each(function()
    {
      var $dropdownMenu = navbarView.$(this);
      var visible = false;

      $dropdownMenu.children().each(function()
      {
        visible = visible || this.style.display !== 'none';
      });

      if (!visible)
      {
        $dropdownMenu.parent().hide();
      }
    });
  };

  /**
   * @private
   * @param {boolean} online
   */
  NavbarView.prototype.toggleConnectionStatusEntries = function(online)
  {
    var navbarView = this;

    this.$('li[data-online]').each(function()
    {
      var $li = navbarView.$(this);

      if (typeof $li.attr('data-disabled') !== 'undefined')
      {
        return $li.addClass('disabled');
      }

      switch ($li.attr('data-online'))
      {
        case 'show':
          $li[online ? 'show' : 'hide']();
          break;

        case 'hide':
          $li[online ? 'hide' : 'show']();
          break;

        default:
          $li[online ? 'removeClass' : 'addClass']('disabled');
          break;
      }
    });
  };

  return NavbarView;
});
