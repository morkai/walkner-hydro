// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  '../views/TablesView',
  'i18n!app/nls/analytics'
], function(
  viewport,
  t,
  Page,

  TablesView
) {
  'use strict';

  /**
   * @name app.users.pages.TablesPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} [options]
   * @param {h5.rql.Query} [options.rql]
   */
  var TablesPage = Page.extend({

    breadcrumbs: [
      t.bound('analytics', 'BREADCRUMBS_ANALYTICS'),
      t.bound('analytics', 'BREADCRUMBS_CHANGES')
    ],

    actions: function()
    {
      var page = this;

      return [
        {
          label: t.bound('analytics', 'PAGE_ACTION_CSV'),
          icon: 'download',
          callback: function()
          {
            page.tablesView.exportToCsv();

            return false;
          }
        }
      ];
    }

  });

  TablesPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  TablesPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('analytics-tables')
      .setBreadcrumbs(this.breadcrumbs)
      .setActions(this.actions);

    pageLayout.setView('.bd', this.tablesView).render();
  };

  /**
   * @private
   */
  TablesPage.prototype.defineModels = function()
  {

  };

  /**
   * @private
   */
  TablesPage.prototype.defineViews = function()
  {
    this.tablesView = new TablesView();
  };

  return TablesPage;
});
