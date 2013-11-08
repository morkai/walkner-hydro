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
