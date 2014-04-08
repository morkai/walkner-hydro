// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  'app/core/views/ActionFormView',
  '../User',
  '../views/UserDetailsView',
  'i18n!app/nls/users'
], function(
  viewport,
  t,
  Page,
  ActionFormView,
  User,
  UserDetailsView
) {
  'use strict';

  /**
   * @name app.users.pages.UserDetailsPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} options
   * @param {string} options.userId
   */
  var UserDetailsPage = Page.extend({

    breadcrumbs: function()
    {
      return [
        {
          label: t.bound('users', 'BREADCRUMBS_BROWSE'),
          href: '#users'
        },
        {
          label: this.user.get('login')
        }
      ];
    },

    actions: function()
    {
      var user = this.user;

      return [
        {
          label: t.bound('users', 'PAGE_ACTION_EDIT'),
          icon: 'edit',
          href: user.genUrl('edit'),
          privileges: 'USERS_MANAGE'
        },
        {
          label: t.bound('users', 'PAGE_ACTION_DELETE'),
          icon: 'remove',
          href: user.genUrl('delete'),
          privileges: 'USERS_MANAGE',
          callback: function(e)
          {
            if (e.which !== 1)
            {
              return;
            }

            ActionFormView.showDeleteDialog({
              model: user,
              labelProperty: 'login',
              nlsDomain: 'users'
            });

            e.preventDefault();
          }
        }
      ];
    }

  });

  UserDetailsPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  UserDetailsPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('users-view-details');

    pageLayout.setView('.bd', this.userDetailsView);

    var page = this;
    var userXhr = this.user.fetch();

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.user.off();
        userXhr.abort();
      })
      .setLimit(1);

    this.user.on('change', function()
    {
      abortSub.cancel();
      pageLayout
        .setBreadcrumbs(page.breadcrumbs)
        .setActions(page.actions);
    });
  };

  /**
   * @private
   */
  UserDetailsPage.prototype.defineModels = function()
  {
    this.user = new User({_id: this.options.userId});

    this.user.on('request', viewport.msg.loading);
    this.user.on('sync', viewport.msg.loaded);
    this.user.on('error', function()
    {
      viewport.msg.loadingFailed(t('users', 'MSG_LOADING_USER_FAILED'));
    });
  };

  /**
   * @private
   */
  UserDetailsPage.prototype.defineViews = function()
  {
    this.userDetailsView = new UserDetailsView({
      model: this.user
    });
  };

  return UserDetailsPage;
});
