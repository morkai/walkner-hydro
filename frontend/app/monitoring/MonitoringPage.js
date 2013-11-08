define([
  '../viewport',
  '../i18n',
  '../core/Page',
  './MonitoringView',
  '../alarms/Alarm',
  '../alarms/AlarmsCollection',
  '../alarms/views/AlarmsListView',
  'i18n!app/nls/monitoring',
  'i18n!app/nls/alarms'
], function(
  viewport,
  t,
  Page,
  MonitoringView,
  Alarm,
  AlarmsCollection,
  AlarmsListView
) {
  'use strict';

  /**
   * @name app.monitoring.MonitoringPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} [options]
   * @param {h5.rql.Query} [options.rql]
   */
  var MonitoringPage = Page.extend({

  });

  MonitoringPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  MonitoringPage.prototype.render = function()
  {
    var pageLayout = viewport.useLayout('page').setId('monitoring');

    pageLayout.setView('.bd', this.monitoringView).render();
    pageLayout.insertView('.bd', this.alarmsListView);

    var page = this;
    var alarmsXhr = this.alarms.fetch({reset: true});

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.alarms.off();
        alarmsXhr.abort();
      })
      .setLimit(1);

    alarmsXhr.done(function()
    {
      abortSub.cancel();
      page.alarmsListView.render();
    });
  };

  MonitoringPage.prototype.defineModels = function()
  {
    this.alarms = new AlarmsCollection(null, {
      rqlQuery:
        'select(name,state,lastStateChangeTime,severity,stopConditionMode)'
          + '&sort(-lastStateChangeTime)'
          + '&limit(8,' + 8 * (this.options.alarmsPage - 1) + ')'
          + '&state=' + Alarm.State.ACTIVE
    });
    this.alarms.genPaginationUrlTemplate = function()
    {
      return '#monitoring?alarmsPage=${page}';
    };
    this.alarms.on('request', viewport.msg.loading);
    this.alarms.on('sync', viewport.msg.loaded);
    this.alarms.on('error', function()
    {
      viewport.msg.loadingFailed(t('alarms', 'MSG_LOADING_ALARMS_FAILED'));
    });
  };

  /**
   * @private
   */
  MonitoringPage.prototype.defineViews = function()
  {
    this.monitoringView = new MonitoringView();

    this.alarmsListView = new AlarmsListView({
      model: this.alarms,
      hideStateColumn: true,
      hideManageActions: true,
      nameLabel: t.bound('monitoring', 'ALARM_COLUMN:name'),
      lastStateChangeTimeLabel:
        t.bound('monitoring', 'ALARM_COLUMN:lastStateChangeTime')
    });
  };

  return MonitoringPage;
});
