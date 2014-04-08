// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  'app/tags/Tag',
  'app/tags/TagsCollection',
  '../views/ChangesView',
  'i18n!app/nls/analytics'
], function(
  viewport,
  t,
  Page,
  Tag,
  TagsCollection,
  ChangesView
) {
  'use strict';

  /**
   * @name app.users.pages.ChangesPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} [options]
   * @param {h5.rql.Query} [options.rql]
   */
  var ChangesPage = Page.extend({

    breadcrumbs: [
      t.bound('analytics', 'BREADCRUMBS_ANALYTICS'),
      t.bound('analytics', 'BREADCRUMBS_CHANGES')
    ]

  });

  ChangesPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  ChangesPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('analytics-changes')
      .setBreadcrumbs(this.breadcrumbs);

    pageLayout.setView('.bd', this.changesView);

    var page = this;
    var tagsXhr = this.tags.fetch({reset: true});

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.tags.off();
        tagsXhr.abort();
      })
      .setLimit(1);

    this.tags.once('reset', function()
    {
      abortSub.cancel();
    });
  };

  /**
   * @private
   */
  ChangesPage.prototype.defineModels = function()
  {
    this.tags = new TagsCollection(null, {
      rqlQuery: this.options.rql
    });

    this.tags.on('request', viewport.msg.loading);
    this.tags.on('sync', viewport.msg.loaded);
    this.tags.on('error', function()
    {
      viewport.msg.loadingFailed(t('tags', 'MSG_LOADING_TAGS_FAILED'));
    });
  };

  /**
   * @private
   */
  ChangesPage.prototype.defineViews = function()
  {
    this.changesView = new ChangesView({
      model: this.tags
    });
  };

  return ChangesPage;
});
