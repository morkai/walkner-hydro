// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'jquery',
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  '../Alarm',
  '../views/AlarmFormView',
  'app/users/UsersCollection',
  'i18n!app/nls/alarms',
  'i18n!app/nls/users'
], function(
  $,
  viewport,
  t,
  Page,
  Alarm,
  AlarmFormView,
  UsersCollection
) {
  'use strict';

  /**
   * @name app.alarms.pages.EditAlarmFormPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} options
   * @param {string} options.alarmId
   */
  var EditAlarmFormPage = Page.extend({

    breadcrumbs: function()
    {
      return [
        {
          label: t.bound('alarms', 'BREADCRUMBS_BROWSE'),
          href: '#alarms'
        },
        {
          label: this.alarm.get('name'),
          href: this.alarm.genUrl()
        },
        {
          label: t.bound('alarms', 'BREADCRUMBS_EDIT_FORM')
        }
      ];
    }

  });

  EditAlarmFormPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  EditAlarmFormPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('alarms-edit-form');

    pageLayout.setView('.bd', this.alarmFormView);

    var page = this;
    var alarmXhr = this.alarm.fetch();
    var usersXhr = this.users.fetch({reset: true});

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.alarm.off();
        page.users.off();
        alarmXhr.abort();
        usersXhr.abort();
      })
      .setLimit(1);

    $.when(alarmXhr, usersXhr).done(function()
    {
      abortSub.cancel();
      pageLayout.setBreadcrumbs(page.breadcrumbs);
      page.alarmFormView.render();
    });
  };

  /**
   * @private
   */
  EditAlarmFormPage.prototype.defineModels = function()
  {
    this.alarm = new Alarm({_id: this.options.alarmId});
    this.users = new UsersCollection(null, {
      rqlQuery: 'select(login,email,mobile)&sort(+login)'
    });

    this.alarm.on('request', viewport.msg.loading);
    this.alarm.on('sync', viewport.msg.loaded);
    this.alarm.on('error', function()
    {
      viewport.msg.loadingFailed(t('alarms', 'MSG_LOADING_ALARM_FAILED'));
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
  EditAlarmFormPage.prototype.defineViews = function()
  {
    this.alarmFormView = new AlarmFormView({
      model: {
        alarm: this.alarm,
        users: this.users
      },
      formMethod: 'PUT',
      formAction: '/alarms/' + this.alarm.id,
      formActionText: t('alarms', 'FORM_ACTION_EDIT'),
      genericFailureText: t('alarms', 'FORM_ERROR_EDIT_FAILED'),
      failureText: t.bind(null, 'alarms', 'FORM_ERROR_EDIT_FAILED_REASON'),
      requirePassword: false
    });
  };

  return EditAlarmFormPage;
});
