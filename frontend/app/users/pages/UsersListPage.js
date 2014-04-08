// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  'app/users/User',
  '../UsersCollection',
  '../views/UsersListView',
  'i18n!app/nls/users'
], function(
  viewport,
  t,
  Page,
  User,
  UsersCollection,
  UsersListView
) {
  'use strict';

  /**
   * @name app.users.pages.UsersListPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} [options]
   * @param {h5.rql.Query} [options.rql]
   */
  var UsersListPage = Page.extend({

    breadcrumbs: [
      t.bound('users', 'BREADCRUMBS_BROWSE')
    ],

    actions: [
      {
        label: t.bound('users', 'PAGE_ACTION_ADD'),
        icon: 'plus',
        href: '#users;add',
        privileges: 'USERS_MANAGE'
      }
    ]

  });

  UsersListPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  UsersListPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('users-browse');

    pageLayout.setView('.bd', this.usersListView);

    var page = this;
    var usersXhr = this.users.fetch({reset: true});

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.users.off();
        usersXhr.abort();
      })
      .setLimit(1);

    this.users.on('reset', function()
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
  UsersListPage.prototype.defineModels = function()
  {
    this.users = new UsersCollection(null, {
      rqlQuery: this.options.rql
    });

    this.users.on('request', viewport.msg.loading);
    this.users.on('sync', viewport.msg.loaded);
    this.users.on('error', function()
    {
      viewport.msg.loadingFailed(t('users', 'MSG_LOADING_USERS_FAILED'));
    });
  };

  /**
   * @private
   */
  UsersListPage.prototype.defineViews = function()
  {
    this.usersListView = new UsersListView({
      model: this.users
    });
  };

  return UsersListPage;
});
