// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  'app/core/views/ActionFormView',
  '../Alarm',
  'i18n!app/nls/alarms'
], function(
  _,
  viewport,
  t,
  Page,
  ActionFormView,
  Alarm
) {
  'use strict';

  /**
   * @name app.alarms.pages.AlarmActionFormPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} options
   * @param {string} options.alarmId
   */
  var AlarmActionFormPage = Page.extend({

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
          label: t.bound(
            'alarms', 'BREADCRUMBS_ACTION_FORM:' + this.options.actionKey
          )
        }
      ];
    }

  });

  AlarmActionFormPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  AlarmActionFormPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('alarms-action-form');

    pageLayout.setView('.bd', this.actionFormView);

    var page = this;
    var alarmXhr = this.alarm.fetch();

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.alarm.off();
        alarmXhr.abort();
      })
      .setLimit(1);

    this.alarm.on('change', function()
    {
      abortSub.cancel();
      pageLayout.setBreadcrumbs(page.breadcrumbs);
    });
  };

  /**
   * @private
   */
  AlarmActionFormPage.prototype.defineModels = function()
  {
    this.alarm = new Alarm({_id: this.options.alarmId});

    this.alarm.on('request', viewport.msg.loading);
    this.alarm.on('sync', viewport.msg.loaded);
    this.alarm.on('error', function()
    {
      viewport.msg.loadingFailed(t('alarms', 'MSG_LOADING_ALARM_FAILED'));
    });
  };

  /**
   * @private
   */
  AlarmActionFormPage.prototype.defineViews = function()
  {
    var actionKey = this.options.actionKey;

    this.actionFormView = new ActionFormView(
      _.defaults({model: this.alarm}, this.options, {
        formActionText: t.bound('alarms', 'ACTION_FORM_BUTTON:' + actionKey),
        messageText: t.bound('alarms', 'ACTION_FORM_MESSAGE:' + actionKey),
        failureText:
          t.bound('alarms', 'ACTION_FORM_MESSAGE_FAILURE:' + actionKey),
        requestData: {action: actionKey}
      })
    );
  };

  return AlarmActionFormPage;
});
