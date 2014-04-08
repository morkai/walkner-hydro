// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/router',
  'app/user',
  'app/viewport',
  'app/i18n',
  './views/ChartsView',
  './pages/ChangesPage',
  './pages/TagChangesPage',
  'i18n!app/nls/analytics'
], function(
  router,
  user,
  viewport,
  t,
  ChartsView,
  ChangesPage,
  TagChangesPage
) {
  'use strict';

  var canView = user.auth('ANALYTICS_VIEW');

  router.map('/analytics/charts', canView, function showCharts()
  {
    viewport
      .useLayout('page')
      .setId('analytics-charts')
      .setBreadcrumbs([
        t.bound('analytics', 'BREADCRUMBS_ANALYTICS'),
        t.bound('analytics', 'BREADCRUMBS_CHARTS')
      ])
      .setView('.bd', new ChartsView())
      .render();
  });

  router.map('/analytics/changes', canView, function showChanges(req)
  {
    new ChangesPage({rql: req.rql}).render();
  });

  router.map('/analytics/changes/:tag', canView, function showTagChanges(req)
  {
    new TagChangesPage({tag: req.params.tag, rql: req.rql}).render();
  });
});
