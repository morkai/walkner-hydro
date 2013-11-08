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
   * @name app.users.pages.EditUserFormPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} options
   * @param {string} options.userId
   */
  var EditUserFormPage = Page.extend({

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
          label: t.bound('users', 'BREADCRUMBS_EDIT_FORM')
        }
      ];
    }

  });

  EditUserFormPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  EditUserFormPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('users-edit-form');

    pageLayout.setView('.bd', this.userFormView);

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
  EditUserFormPage.prototype.defineModels = function()
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
  EditUserFormPage.prototype.defineViews = function()
  {
    this.userFormView = new UserFormView({
      model: this.user,
      formMethod: 'PUT',
      formAction: '/users/' + this.user.id,
      formActionText: t('users', 'FORM_ACTION_EDIT'),
      failureText: t('users', 'FORM_ERROR_EDIT_FAILED'),
      requirePassword: false
    });
  };

  return EditUserFormPage;
});
