// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  '../User',
  'app/core/views/ActionFormView',
  'i18n!app/nls/users'
], function(
  _,
  viewport,
  t,
  Page,
  User,
  ActionFormView
) {
  'use strict';

  /**
   * @name app.users.pages.UserActionFormPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} options
   * @param {string} options.userId
   */
  var UserActionFormPage = Page.extend({

    breadcrumbs: function()
    {
      return [
        {
          label: t.bound('users', 'BREADCRUMBS_BROWSE'),
          href: '#users'
        },
        {
          label: this.user.get('login'),
          href: this.user.genUrl()
        },
        {
          label: t.bound(
            'users', 'BREADCRUMBS_ACTION_FORM:' + this.options.actionKey
          )
        }
      ];
    }

  });

  UserActionFormPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  UserActionFormPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('users-action-form');

    pageLayout.setView('.bd', this.actionFormView);

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
      pageLayout.setBreadcrumbs(page.breadcrumbs);
    });
  };

  /**
   * @private
   */
  UserActionFormPage.prototype.defineModels = function()
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
  UserActionFormPage.prototype.defineViews = function()
  {
    var actionKey = this.options.actionKey;

    this.actionFormView = new ActionFormView(
      _.defaults({model: this.user}, this.options, {
        formActionText: t.bound('users', 'ACTION_FORM_BUTTON:' + actionKey),
        messageText: t.bound('users', 'ACTION_FORM_MESSAGE:' + actionKey),
        failureText:
          t.bound('users', 'ACTION_FORM_MESSAGE_FAILURE:' + actionKey),
        requestData: {action: actionKey}
      })
    );
  };

  return UserActionFormPage;
});
