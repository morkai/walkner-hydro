define([
  'jquery',
  'backbone',
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  'app/core/views/GridView',
  '../Event',
  '../EventsCollection',
  '../views/EventsListView',
  '../views/EventsFilterView',
  'app/users/UsersCollection',
  'i18n!app/nls/events',
  'i18n!app/nls/users'
], function(
  $,
  Backbone,
  viewport,
  t,
  Page,
  GridView,
  Event,
  EventsCollection,
  EventsListView,
  EventsFilterView,
  UsersCollection
) {
  'use strict';

  /**
   * @name app.events.EventsListPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} [options]
   * @param {h5.rql.Query} [options.rql]
   */
  var EventsListPage = Page.extend({

    breadcrumbs: [
      t.bound('events', 'BREADCRUMBS_BROWSE')
    ]

  });

  EventsListPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  EventsListPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('events-browse')
      .setBreadcrumbs(this.breadcrumbs);

    pageLayout.setView('.bd', this.gridView);

    var page = this;
    var eventsXhr = this.events.fetch({reset: true});
    var eventTypesXhr = this.eventTypes.fetch({reset: true});
    var usersXhr = this.users.fetch({reset: true});

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.events.off();
        page.eventTypes.off();
        page.users.off();
        eventsXhr.abort();
        eventTypesXhr.abort();
        usersXhr.abort();
      })
      .setLimit(1);

    $.when(eventsXhr, eventTypesXhr, usersXhr).done(function()
    {
      abortSub.cancel();
      page.gridView.render();
    });
  };

  /**
   * @private
   */
  EventsListPage.prototype.defineModels = function()
  {
    this.events = new EventsCollection(null, {
      rqlQuery: this.options.rql
    });
    this.eventTypes = new Backbone.Collection(null, {url: '/events/types'});
    this.eventTypes.parse = function(response)
    {
      return response.map(function(type)
      {
        return {value: type, label: t.bound('events', 'TYPE:' + type)};
      });
    };
    this.users = new UsersCollection(null, {
      rqlQuery: 'select(login)&sort(+login)'
    });

    this.events.on('request', viewport.msg.loading);
    this.events.on('sync', viewport.msg.loaded);
    this.events.on('error', function()
    {
      viewport.msg.loadingFailed(t('events', 'MSG_LOADING_EVENTS_FAILED'));
    });

    this.eventTypes.on('request', viewport.msg.loading);
    this.eventTypes.on('sync', viewport.msg.loaded);
    this.eventTypes.on('error', function()
    {
      viewport.msg.loadingFailed(t('events', 'MSG_LOADING_EVENT_TYPES_FAILED'));
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
  EventsListPage.prototype.defineViews = function()
  {
    this.eventsListView = new EventsListView({
      model: this.events
    });

    this.eventsFilterView = new EventsFilterView({
      model: {
        rqlQuery: this.events.rqlQuery,
        eventTypes: this.eventTypes,
        users: this.users
      }
    });
    this.eventsFilterView.on('filterChanged', this.refreshEventList, this);

    this.gridView = new GridView({
      rows: [
        {columns: [{className: 'events-filter-container'}]},
        {columns: [{className: 'events-list-container'}]}
      ],
      views: {
        '.events-filter-container': this.eventsFilterView,
        '.events-list-container': this.eventsListView
      }
    });
  };

  /**
   * @private
   * @param {h5.rql.Query} newRqlQuery
   */
  EventsListPage.prototype.refreshEventList = function(newRqlQuery)
  {
    this.events.rqlQuery = newRqlQuery;

    this.eventsListView.refreshCollection(null, true);

    this.broker.publish('router.navigate', {
      url: '#events?' + newRqlQuery,
      trigger: false,
      replace: true
    });
  };

  return EventsListPage;
});
