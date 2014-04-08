// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  '../router',
  '../user',
  './MonitoringPage',
  'i18n!app/nls/monitoring'
], function(
  router,
  user,
  MonitoringPage
) {
  'use strict';

  router.map(
    '/monitoring',
    user.auth('MONITORING_VIEW'),
    function showMonitoringPage(req)
    {
      var page = new MonitoringPage({
        alarmsPage: req.params.alarmsPage || 1
      });

      page.render();
    }
  );
});
