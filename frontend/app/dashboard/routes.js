// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
