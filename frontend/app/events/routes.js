// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/router',
  'app/user',
  './pages/EventsListPage',
  'i18n!app/nls/events'
], function(
  router,
  user,
  EventsListPage
) {
  'use strict';

  router.map(
    '/events', user.auth('EVENTS_VIEW'), function showEventsListPage(req)
    {
      new EventsListPage({rql: req.rql}).render();
    }
  );
});
