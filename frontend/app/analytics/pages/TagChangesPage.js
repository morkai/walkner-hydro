define([
  'app/viewport',
  'app/i18n',
  'app/core/Page',
  'app/tags/TagValuesCollection',
  '../views/TagChangesView',
  'i18n!app/nls/analytics',
  'i18n!app/nls/tags'
], function(
  viewport,
  t,
  Page,
  TagValuesCollection,
  TagChangesView
) {
  'use strict';

  /**
   * @name app.users.pages.TagChangesPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} [options]
   * @param {h5.rql.Query} [options.rql]
   */
  var TagChangesPage = Page.extend({

    breadcrumbs: function()
    {
      return [
        t.bound('analytics', 'BREADCRUMBS_ANALYTICS'),
        {
          label: t.bound('analytics', 'BREADCRUMBS_CHANGES'),
          href: '#analytics/changes'
        },
        t.bound('tags', 'TAG:' + this.options.tag)
      ];
    }

  });

  TagChangesPage.prototype.initialize = function()
  {
    this.defineModels();
    this.defineViews();
  };

  TagChangesPage.prototype.render = function()
  {
    var pageLayout = viewport
      .useLayout('page')
      .setId('analytics-changes-tag')
      .setBreadcrumbs(this.breadcrumbs);

    pageLayout.setView('.bd', this.tagChangesView);

    var page = this;
    var tagValuesXhr = this.tagValues.fetch({reset: true});

    var abortSub = this.broker
      .subscribe('router.executing', function()
      {
        page.tagValues.off();
        tagValuesXhr.abort();
      })
      .setLimit(1);

    this.tagValues.once('reset', function()
    {
      abortSub.cancel();
    });
  };

  /**
   * @private
   */
  TagChangesPage.prototype.defineModels = function()
  {
    this.tagValues = new TagValuesCollection(null, {
      rqlQuery: this.options.rql,
      tag: this.options.tag
    });

    this.tagValues.on('request', viewport.msg.loading);
    this.tagValues.on('sync', viewport.msg.loaded);
    this.tagValues.on('error', function()
    {
      viewport.msg.loadingFailed(t('tags', 'MSG_LOADING_TAG_VALUES_FAILED'));
    });
  };

  /**
   * @private
   */
  TagChangesPage.prototype.defineViews = function()
  {
    this.tagChangesView = new TagChangesView({
      model: this.tagValues
    });
  };

  return TagChangesPage;
});
