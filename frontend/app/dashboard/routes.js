define([
  '../router',
  '../viewport',
  '../i18n',
  'i18n!app/nls/dashboard'
], function(
  router,
  viewport,
  i18n
) {
  'use strict';

  router.map('/', function showDashboard()
  {
    router.replace('/monitoring');
  });

  router.map('/locale/:locale', function changeLocale(req)
  {
    i18n.reload(req.params.locale);
  });
});
