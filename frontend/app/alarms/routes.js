// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  '../router',
  '../user',
  './pages/AlarmsListPage',
  './pages/AlarmDetailsPage',
  './pages/AddAlarmFormPage',
  './pages/EditAlarmFormPage',
  './pages/AlarmActionFormPage',
  'i18n!app/nls/alarms'
], function(
  router,
  user,
  AlarmsListPage,
  AlarmDetailsPage,
  AddAlarmFormPage,
  EditAlarmFormPage,
  AlarmActionFormPage
) {
  'use strict';

  var canView = user.auth('ALARMS_VIEW');
  var canManage = user.auth('ALARMS_MANAGE');

  router.map('/alarms', canView, function showAlarmsListPage(req)
  {
    var page = new AlarmsListPage({
      rql: req.rql
    });

    page.render();
  });

  router.map('/alarms/:id', canView, function showAlarmDetailsPage(req)
  {
    var page = new AlarmDetailsPage({
      alarmId: req.params.id,
      eventsPage: req.query.eventsPage
    });

    page.render();
  });

  router.map('/alarms;add', canManage, function showAddAlarmFormPage()
  {
    var page = new AddAlarmFormPage();

    page.render();
  });

  router.map('/alarms/:id;edit', canManage, function showEditAlarmFormPage(req)
  {
    var page = new EditAlarmFormPage({
      alarmId: req.params.id
    });

    page.render();
  });

  router.map(
    '/alarms/:id;delete',
    canManage,
    function showDeleteAlarmFormPage(req, referer)
    {
      var page = new AlarmActionFormPage({
        alarmId: req.params.id,
        actionKey: 'delete',
        successUrl: '#alarms',
        cancelUrl: '#' + (referer || '/alarms').substr(1),
        formMethod: 'DELETE',
        formAction: '/alarms/' + req.params.id,
        formActionSeverity: 'danger'
      });

      page.render();
    }
  );

  router.map(
    '/alarms/:id;run',
    canManage,
    function showRunAlarmFormPage(req, referer)
    {
      var backUrl = '#' + (referer || '/alarms').substr(1);

      var page = new AlarmActionFormPage({
        alarmId: req.params.id,
        actionKey: 'run',
        successUrl: backUrl,
        cancelUrl: backUrl,
        formAction: '/alarms/' + req.params.id
      });

      page.render();
    }
  );

  router.map(
    '/alarms/:id;stop',
    canManage,
    function showStopAlarmFormPage(req, referer)
    {
      var backUrl = '#' + (referer || '/alarms').substr(1);

      var page = new AlarmActionFormPage({
        alarmId: req.params.id,
        actionKey: 'stop',
        successUrl: backUrl,
        cancelUrl: backUrl,
        formAction: '/alarms/' + req.params.id,
        formActionSeverity: 'warning'
      });

      page.render();
    }
  );
});
