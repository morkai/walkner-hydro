define([
  'jquery',
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  'app/core/views/GridView',
  'app/core/views/ActionFormView',
  '../Alarm',
  '../views/AlarmDetailsView',
  'app/users/UsersCollection',
  'app/events/EventsCollection',
  'app/events/views/EventsListView',
  'i18n!app/nls/alarms',
  'i18n!app/nls/users',
  'i18n!app/nls/events'
], function(
  $,
  viewport,
  t,
  Page,
  GridView,
  ActionFormView,
  Alarm,
  AlarmDetailsView,
  UsersCollection,
  EventsCollection,
  EventsListView
) {
  'use strict';

  /**
   * @name app.alarms.pages.AlarmDetailsPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} options
   * @param {string} options.alarmId
   */
  var AlarmDetailsPage = Page.extend({

    breadcrumbs: function()
    {
      return [
        {
          label: t.bound('alarms', 'BREADCRUMBS_BROWSE'),
          href: '#alarms'
        },
        {
          label: this.alarm.get('name')
        }
      ];
    },

    actions: function()
    {
      var alarm = this.alarm;
      var actions = [];

      if (alarm.get('state') === Alarm.State.ACTIVE
        && alarm.get('stopConditionMode') === Alarm.StopConditionMode.MANUAL)
      {
        actions.push({
          label: t.bound('alarms', 'PAGE_ACTION_ACK'),
          icon: 'thumbs-up',
          href: alarm.genUrl('ack'),
          privileges: ['ALARMS_ACK'],
          callback: function(e)
          {
            if (e.which === 1)
            {
              ActionFormView.showDialog({
                actionKey: 'ack',
                model: alarm,
                labelProperty: 'name',
                nlsDomain: 'alarms',
                formActionSeverity: 'success'
              });

              e.preventDefault();
            }
          }
        });
      }

      if (alarm.get('state') === Alarm.State.STOPPED)
      {
        actions.push({
          label: t.bound('alarms', 'PAGE_ACTION_RUN'),
          icon: 'play',
          href: alarm.genUrl('run'),
          privileges: 'ALARMS_MANAGE',
          callback: function(e)
          {
            if (e.which === 1)
            {
              ActionFormView.showDialog({
                actionKey: 'run',
                model: alarm,
                labelProperty: 'name',
                nlsDomain: 'alarms'
              });

              e.preventDefault();
            }
          }
        });
      }
      else
      {
        actions.push({
          label: t.bound('alarms', 'PAGE_ACTION_STOP'),
          icon: 'pause',
          href: alarm.genUrl('stop'),
          privileges: 'ALARMS_MANAGE',
          callback: function(e)
          {
            if (e.which === 1)
            {
              ActionFormView.showDialog({
                actionKey: 'stop',
                model: alarm,
                labelProperty: 'name',
                nlsDomain: 'alarms',
                formActionSeverity: 'warning'
              });

              e.preventDefault();
            }
          }
        });
      }

      actions.push(
        {
          label: t.bound('alarms', 'PAGE_ACTION_EDIT'),
          icon: 'edit',
          href: alarm.genUrl('edit'),
          privileges: 'ALARMS_MANAGE'
        },
        {
          label: t.bound('alarms', 'PAGE_ACTION_DELETE'),
          icon: 'remove',
          href: alarm.genUrl('delete'),
          privileges: 'ALARMS_MANAGE',
          callback: function(e)
          {
            if (e.which === 1)
            {
              ActionFormView.showDeleteDialog({
                model: alarm,
                labelProperty: 'name',
                nlsDomain: 'alarms'
              });

              e.preventDefault();
            }
          }
        }
      );

      return actions;
    }

  });

  AlarmDetailsPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  AlarmDetailsPage.prototype.render = function()
  {
    var pageLayout = viewport.useLayout('page').setId('alarms-view-details');

    pageLayout.setView('.bd', this.gridView);

    var page = this;
    var alarmXhr = this.alarm.fetch();
    var usersXhr = this.users.fetch({reset: true});
    var eventsXhr = this.events.fetch({reset: true});

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.alarm.off();
        page.users.off();
        page.events.off();
        alarmXhr.abort();
        usersXhr.abort();
        eventsXhr.abort();
      })
      .setLimit(1);

    $.when(alarmXhr, usersXhr, eventsXhr).done(function()
    {
      abortSub.cancel();
      pageLayout.setActions(page.actions);
      pageLayout.setBreadcrumbs(page.breadcrumbs);
      page.gridView.render();

      page.alarm.on('change:state change:stopConditionMode', function()
      {
        pageLayout.setActions(page.actions);
      });
    });
  };

  /**
   * @private
   */
  AlarmDetailsPage.prototype.defineModels = function()
  {
    var page = this;

    this.alarm = new Alarm({_id: this.options.alarmId});
    this.users = new UsersCollection(null, {
      rqlQuery: 'select(login,email,mobile)&sort(+login)'
    });
    this.events = new EventsCollection(null, {
      rqlQuery: 'select(type,severity,user,time,data)'
        + '&sort(-time)'
        + '&limit(15,' + 15 * (page.options.eventsPage - 1) + ')'
        + '&regex(type,%5Ealarms)'
        + '&data.model._id=' + this.options.alarmId
    });
    this.events.genPaginationUrlTemplate = function()
    {
      return page.alarm.genUrl() + '?eventsPage=${page}';
    };

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

    this.events.on('request', viewport.msg.loading);
    this.events.on('sync', viewport.msg.loaded);
    this.events.on('error', function()
    {
      viewport.msg.loadingFailed(t('events', 'MSG_LOADING_EVENTS_FAILED'));
    });
  };

  /**
   * @private
   */
  AlarmDetailsPage.prototype.defineViews = function()
  {
    this.alarmDetailsView = new AlarmDetailsView({
      model: {
        alarm: this.alarm,
        users: this.users
      }
    });

    var alarmId = this.alarm.id;

    this.eventsListView = new EventsListView({
      model: this.events,
      filter: function(event)
      {
        return (/^alarms/).test(event.type) && event.data.model._id === alarmId;
      }
    });

    this.gridView = new GridView({
      columns: [
        {span: 6, className: 'alarms-details-container'},
        {span: 6, className: 'alarms-events-container'}
      ],
      views: {
        '.alarms-details-container': this.alarmDetailsView,
        '.alarms-events-container': this.eventsListView
      }
    });
  };

  return AlarmDetailsPage;
});
