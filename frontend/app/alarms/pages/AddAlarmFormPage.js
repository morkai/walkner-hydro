define([
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  '../Alarm',
  '../views/AlarmFormView',
  'i18n!app/nls/alarms'
], function(
  viewport,
  t,
  Page,
  Alarm,
  AlarmFormView
) {
  'use strict';

  /**
   * @name app.alarms.pages.AddAlarmFormPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} options
   * @param {string} options.alarmId
   */
  var AddAlarmFormPage = Page.extend({

    breadcrumbs: [
      {
        label: t.bound('alarms', 'BREADCRUMBS_BROWSE'),
        href: '#alarms'
      },
      {
        label: t.bound('alarms', 'BREADCRUMBS_ADD_FORM')
      }
    ]

  });

  AddAlarmFormPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  AddAlarmFormPage.prototype.render = function()
  {
    viewport
      .useLayout('page')
      .setId('alarms-add-form')
      .setBreadcrumbs(this.breadcrumbs)
      .setView('.bd', this.alarmFormView)
      .render();
  };

  /**
   * @private
   */
  AddAlarmFormPage.prototype.defineModels = function()
  {
    this.alarm = new Alarm();
  };

  /**
   * @private
   */
  AddAlarmFormPage.prototype.defineViews = function()
  {
    this.alarmFormView = new AlarmFormView({
      model: {
        alarm: this.alarm,
        users: null
      },
      formMethod: 'POST',
      formAction: '/alarms',
      formActionText: t('alarms', 'FORM_ACTION_ADD'),
      genericFailureText: t('alarms', 'FORM_ERROR_ADD_FAILED'),
      failureText: t.bind(null, 'alarms', 'FORM_ERROR_ADD_FAILED_REASON'),
      requirePassword: true
    });
  };

  return AddAlarmFormPage;
});
