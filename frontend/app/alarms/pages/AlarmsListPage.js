// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'app/core/util',
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  'app/core/templates/filterAction',
  '../Alarm',
  '../AlarmsCollection',
  '../views/AlarmsListView',
  'i18n!app/nls/alarms'
], function(
  _,
  util,
  viewport,
  t,
  Page,
  filterActionTemplate,
  Alarm,
  AlarmsCollection,
  AlarmsListView
) {
  'use strict';

  /**
   * @name app.alarms.pages.AlarmsListPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} [options]
   * @param {h5.rql.Query} [options.rql]
   */
  var AlarmsListPage = Page.extend({

    breadcrumbs: [
      t.bound('alarms', 'BREADCRUMBS_BROWSE')
    ],

    actions: function()
    {
      var page = this;

      return [
        {
          template: filterActionTemplate,
          placeholder: t.bound('alarms', 'PAGE_ACTION_FILTER_PLACEHOLDER'),
          privileges: 'ALARMS_MANAGE',
          afterRender: function($action)
          {
            $action
              .find('.page-action-filter')
              .on('submit', page.changeFilter.bind(page));

            $action
              .find('[name="filter"]')
              .val(page.getCurrentFilterValue());
          }
        },
        {
          label: t.bound('alarms', 'PAGE_ACTION_ADD'),
          icon: 'plus',
          href: '#alarms;add',
          privileges: 'ALARMS_MANAGE'
        }
      ];
    }

  });

  AlarmsListPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  AlarmsListPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('alarms-browse');

    pageLayout.setView('.bd', this.alarmsListView);

    var page = this;
    var alarmsXhr = this.alarms.fetch({reset: true});

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.alarms.off();
        alarmsXhr.abort();
      })
      .setLimit(1);

    this.alarms.once('reset', function()
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
  AlarmsListPage.prototype.defineModels = function()
  {
    this.alarms = new AlarmsCollection(null, {
      rqlQuery: this.options.rql
    });

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
  AlarmsListPage.prototype.defineViews = function()
  {
    this.alarmsListView = new AlarmsListView({
      model: this.alarms
    });
  };

  /**
   * @private
   */
  AlarmsListPage.prototype.changeFilter = function(e)
  {
    e.preventDefault();

    var filter =
      util.escapeRegExp(e.target.querySelector('[name="filter"]').value);

    this.alarms.rqlQuery.selector.args = filter === ''
      ? []
      : [{name: 'regex', args: ['name', filter, 'i']}];

    this.alarms.fetch({reset: true});

    this.broker.publish('router.navigate', {
      url: '#alarms?' + this.alarms.rqlQuery,
      trigger: false,
      replace: true
    });
  };

  /**
   * @private
   * @returns {string}
   */
  AlarmsListPage.prototype.getCurrentFilterValue = function()
  {
    var filterTerm = _.find(this.alarms.rqlQuery.selector.args, function(term)
    {
      return term.name === 'regex' && term.args[0] === 'name';
    });

    if (filterTerm)
    {
      return filterTerm.args[1].replace(/\\([^\\])/g, '$1').trim();
    }

    return '';
  };

  return AlarmsListPage;
});
