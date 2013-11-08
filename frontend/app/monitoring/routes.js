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
