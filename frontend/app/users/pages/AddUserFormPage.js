// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  '../User',
  '../views/UserFormView',
  'i18n!app/nls/users'
], function(
  viewport,
  t,
  Page,
  User,
  UserFormView
) {
  'use strict';

  /**
   * @name app.users.pages.AddUserFormPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} options
   * @param {string} options.userId
   */
  var AddUserFormPage = Page.extend({

    breadcrumbs: [
      {
        label: t.bound('users', 'BREADCRUMBS_BROWSE'),
        href: '#users'
      },
      {
        label: t.bound('users', 'BREADCRUMBS_ADD_FORM')
      }
    ]

  });

  AddUserFormPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  AddUserFormPage.prototype.render = function()
  {
    viewport
      .useLayout('page')
      .setId('users-add-form')
      .setBreadcrumbs(this.breadcrumbs)
      .setView('.bd', this.userFormView);
  };

  /**
   * @private
   */
  AddUserFormPage.prototype.defineModels = function()
  {
    this.user = new User();
  };

  /**
   * @private
   */
  AddUserFormPage.prototype.defineViews = function()
  {
    this.userFormView = new UserFormView({
      model: this.user,
      formMethod: 'POST',
      formAction: '/users',
      formActionText: t('users', 'FORM_ACTION_ADD'),
      failureText: t('users', 'FORM_ERROR_ADD_FAILED'),
      requirePassword: true
    });
  };

  return AddUserFormPage;
});
