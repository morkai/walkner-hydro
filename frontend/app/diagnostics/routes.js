define([
  'app/router',
  'app/user',
  'app/viewport',
  'app/i18n',
  'app/core/View',

  './views/SettingsView',
  './views/TagsView',
  './views/VfdView',
  './views/CabinetView',
  './views/AirValveView',
  './views/BlowerView',
  './views/UvLampView',
  './views/FilterSetView',
  './views/ReservoirsView',
  './views/InputPumpView',
  './views/WashingPumpView',
  './views/OutputPumpsView',

  'app/diagnostics/templates/tech',
  'app/diagnostics/templates/hydro',
  'app/diagnostics/templates/filterSets',
  'app/diagnostics/templates/inputPumps',

  'app/diagnostics/templates/filterSetsSettings',
  'app/diagnostics/templates/uvLampSettings',
  'app/diagnostics/templates/reservoirsSettings',
  'app/diagnostics/templates/inputPumpsSettings',
  'app/diagnostics/templates/outputPumpsSettings',

  'i18n!app/nls/diagnostics'
], function(
  router,
  user,
  viewport,
  t,
  View,
  SettingsView,
  TagsView,
  VfdView,
  CabinetView,
  AirValveView,
  BlowerView,
  UvLampView,
  FilterSetView,
  ReservoirsView,
  InputPumpView,
  WashingPumpView,
  OutputPumpsView,
  techTemplate,
  hydroTemplate,
  filterSetsTemplate,
  inputPumpsTemplate,
  filterSetsSettingsTemplate,
  uvLampSettingsTemplate,
  reservoirsSettingsTemplate,
  inputPumpsSettingsTemplate,
  outputPumpsSettingsTemplate
) {
  'use strict';

  var canView = user.auth('DIAGNOSTICS_VIEW');
  var canViewSettings = user.auth(['DIAGNOSTICS_VIEW', 'SETTINGS_VIEW']);

  router.map('/diagnostics/tech', canView, function showTechCabinet()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-tech')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_TECH')
      ])
      .setView('.bd', new CabinetView({
        template: techTemplate
      }))
      .render();
  });

  router.map('/diagnostics/hydro', canView, function showHydroCabinet()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-hydro')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_HYDRO')
      ])
      .setView('.bd', new CabinetView({
        template: hydroTemplate
      }))
      .render();
  });

  router.map('/diagnostics/air-valve', canView, function showAirValve()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-air-valve')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_AIR_VALVE')
      ])
      .setView('.bd', new AirValveView())
      .render();
  });

  router.map('/diagnostics/blower', canView, function showBlower()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-blower')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_BLOWER')
      ])
      .setView('.bd', new BlowerView())
      .render();
  });

  router.map('/diagnostics/uv-lamp', canView, function showUvLamp()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-uv-lamp')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_UV_LAMP')
      ])
      .setActions([
        {
          href: '#diagnostics/uv-lamp/settings',
          label: t.bound('diagnostics', 'PAGE_ACTION_SETTINGS'),
          icon: 'cog'
        }
      ])
      .setView('.bd', new UvLampView())
      .render();
  });

  router.map(
    '/diagnostics/uv-lamp/settings',
    canViewSettings,
    function showUvLampSettings()
    {
      viewport
        .useLayout('page')
        .setId('diagnostics-uv-lamp-settings')
        .setBreadcrumbs([
          t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
          {
            label: t.bound('diagnostics', 'BREADCRUMBS_UV_LAMP'),
            href: '#diagnostics/uv-lamp'
          },
          t.bound('diagnostics', 'BREADCRUMBS_SETTINGS')
        ])
        .setView('.bd', new SettingsView({
          template: uvLampSettingsTemplate
        }))
        .render();
    }
  );

  router.map('/diagnostics/filter-sets', canView, function showFilterSets()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-filter-sets')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_FILTER_SETS')
      ])
      .setActions([
        {
          href: '#diagnostics/filter-sets/settings',
          label: t.bound('diagnostics', 'PAGE_ACTION_SETTINGS'),
          icon: 'cog'
        }
      ])
      .setView('.bd', new View({
        template: filterSetsTemplate
      }))
      .render();
  });

  router.map(
    '/diagnostics/filter-sets/:id', canView, function showFilterSet(req)
    {
      viewport
        .useLayout('page')
        .setId('diagnostics-filter-set')
        .setBreadcrumbs([
          t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
          {
            label: t.bound('diagnostics', 'BREADCRUMBS_FILTER_SETS'),
            href: '#diagnostics/filter-sets'
          },
          t.bound('diagnostics', 'BREADCRUMBS_FILTER_SET', {id: req.params.id})
        ])
        .setActions([
          {
            href: '#diagnostics/filter-sets/settings',
            label: t.bound('diagnostics', 'PAGE_ACTION_SETTINGS'),
            icon: 'cog',
            privilege: canViewSettings
          }
        ])
        .setView('.bd', new FilterSetView({id: req.params.id}))
        .render();
    }
  );

  router.map(
    '/diagnostics/filter-sets/settings',
    canViewSettings,
    function showFilterSetsSettings()
    {
      viewport
        .useLayout('page')
        .setId('diagnostics-filter-set-settings')
        .setBreadcrumbs([
          t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
          {
            label: t.bound('diagnostics', 'BREADCRUMBS_FILTER_SETS'),
            href: '#diagnostics/filter-sets'
          },
          t.bound('diagnostics', 'BREADCRUMBS_SETTINGS')
        ])
        .setView('.bd', new SettingsView({
          template: filterSetsSettingsTemplate
        }))
        .render();
    }
  );

  router.map('/diagnostics/reservoirs', canView, function showReservoirs()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-reservoirs')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_RESERVOIRS')
      ])
      .setActions([
        {
          href: '#diagnostics/reservoirs/settings',
          label: t.bound('diagnostics', 'PAGE_ACTION_SETTINGS'),
          icon: 'cog',
          privilege: canViewSettings
        }
      ])
      .setView('.bd', new ReservoirsView())
      .render();
  });

  router.map(
    '/diagnostics/reservoirs/settings',
    canViewSettings,
    function showReservoirsSettings()
    {
      viewport
        .useLayout('page')
        .setId('diagnostics-reservoirs-settings')
        .setBreadcrumbs([
          t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
          {
            label: t.bound('diagnostics', 'BREADCRUMBS_RESERVOIRS'),
            href: '#diagnostics/reservoirs'
          },
          t.bound('diagnostics', 'BREADCRUMBS_SETTINGS')
        ])
        .setView('.bd', new SettingsView({
          template: reservoirsSettingsTemplate
        }))
        .render();
    }
  );

  router.map('/diagnostics/input-pumps', canView, function showInputPumps()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-input-pumps')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_INPUT_PUMPS')
      ])
      .setActions([
        {
          href: '#diagnostics/input-pumps/settings',
          label: t.bound('diagnostics', 'PAGE_ACTION_SETTINGS'),
          icon: 'cog'
        }
      ])
      .setView('.bd', new View({
        template: inputPumpsTemplate
      }))
      .render();
  });

  router.map(
    '/diagnostics/input-pumps/:id',
    canView,
    function showInputPump(req)
    {
      viewport
        .useLayout('page')
        .setId('diagnostics-input-pump')
        .setBreadcrumbs([
          t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
          {
            label: t.bound('diagnostics', 'BREADCRUMBS_INPUT_PUMPS'),
            href: '#diagnostics/input-pumps'
          },
          t.bound('diagnostics', 'BREADCRUMBS_INPUT_PUMP', {id: req.params.id})
        ])
        .setActions([
          {
            href: '#diagnostics/input-pumps/settings',
            label: t.bound('diagnostics', 'PAGE_ACTION_SETTINGS'),
            icon: 'cog'
          }
        ])
        .setView('.bd', new InputPumpView({
          id: req.params.id
        }))
        .render();
    }
  );

  router.map(
    '/diagnostics/input-pumps/settings',
    canViewSettings,
    function showInputPumpsSettings()
    {
      viewport
        .useLayout('page')
        .setId('diagnostics-input-pumps-settings')
        .setBreadcrumbs([
          t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
          {
            label: t.bound('diagnostics', 'BREADCRUMBS_INPUT_PUMPS'),
            href: '#diagnostics/input-pumps'
          },
          t.bound('diagnostics', 'BREADCRUMBS_SETTINGS')
        ])
        .setView('.bd', new SettingsView({
          template: inputPumpsSettingsTemplate
        }))
        .render();
    }
  );

  router.map('/diagnostics/washing-pump', canView, function showWashingPump()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-washing-pump')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_WASHING_PUMP')
      ])
      .setView('.bd', new WashingPumpView())
      .render();
  });

  router.map('/diagnostics/output-pumps', canView, function showOutputPumps(req)
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-output-pumps')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_OUTPUT_PUMPS')
      ])
      .setActions([
        {
          href: '#diagnostics/output-pumps/settings',
          label: t.bound('diagnostics', 'PAGE_ACTION_SETTINGS'),
          icon: 'cog'
        }
      ])
      .setView('.bd', new OutputPumpsView({id: req.query.id}))
      .render();
  });

  router.map(
    '/diagnostics/output-pumps/settings',
    canViewSettings,
    function showOutputPumpsSettings()
    {
      viewport
        .useLayout('page')
        .setId('diagnostics-output-pumps-settings')
        .setBreadcrumbs([
          t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
          {
            label: t.bound('diagnostics', 'BREADCRUMBS_OUTPUT_PUMPS'),
            href: '#diagnostics/output-pumps'
          },
          t.bound('diagnostics', 'BREADCRUMBS_SETTINGS')
        ])
        .setView('.bd', new SettingsView({
          template: outputPumpsSettingsTemplate
        }))
        .render();
    }
  );

  router.map(
    '/diagnostics/tags', canViewSettings, function showTagsDiagnostics()
    {
      viewport
        .useLayout('page')
        .setId('diagnostics-tags')
        .setBreadcrumbs([
          t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
          t.bound('diagnostics', 'BREADCRUMBS_TAGS')
        ])
        .setView('.bd', new TagsView())
        .render();
    }
  );

  router.map('/diagnostics/vfd', canViewSettings, function showVfdDiagnostics()
  {
    viewport
      .useLayout('page')
      .setId('diagnostics-vfd')
      .setBreadcrumbs([
        t.bound('diagnostics', 'BREADCRUMBS_DIAG'),
        t.bound('diagnostics', 'BREADCRUMBS_VFD')
      ])
      .setView('.bd', new VfdView())
      .render();
  });
});
