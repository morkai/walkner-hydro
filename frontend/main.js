// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

(function()
{
  'use strict';

  var domains = [];
  var i18n = null;

  require.onError = function(err)
  {
    var loadingEl = document.body.getElementsByClassName('loading')[0];

    if (!loadingEl)
    {
      return;
    }

    loadingEl.getElementsByTagName('span')[0].innerHTML = 'Loading failed :-(';

    var spinnerEl = loadingEl.getElementsByClassName('icon-spinner')[0];

    if (spinnerEl)
    {
      spinnerEl.style.color = 'red';
      spinnerEl.classList.remove('icon-spin');
    }

    var errorEl = document.createElement('p');

    errorEl.className = 'error';
    errorEl.innerHTML = '<span class="error-type">'
      + err.requireType
      + '</span> [' + (err.requireModules || []).join(', ') + ']';

    loadingEl.appendChild(errorEl);

    loadingEl.style.width = 'auto';
    loadingEl.style.width = loadingEl.clientWidth + 'px';
    loadingEl.style.marginLeft = -(loadingEl.clientWidth / 2) + 'px';
  };

  require.onResourceLoad = function(context, map)
  {
    if (map.prefix === 'i18n')
    {
      var keys = context.defined[map.id];
      var domain = map.id.substr(map.id.lastIndexOf('/') + 1);

      if (i18n !== null)
      {
        i18n.register(domain, keys, map.id);
      }
      else
      {
        domains.push([domain, keys, map.id]);
      }
    }
    else if (map.id === 'app/i18n')
    {
      i18n = context.defined[map.id];
      i18n.config = context.config.config.i18n;

      domains.forEach(function(domainData)
      {
        i18n.register(domainData[0], domainData[1], domainData[2]);
      });

      domains = null;
    }
  };
})();

require([
  'domReady',
  'jquery',
  'backbone',
  'backbone.layout',
  'moment',
  'app/monkeyPatch',
  'app/broker',
  'app/time',
  'app/i18n',
  'app/viewport',
  'app/socket',
  'app/router',
  'app/core/views/PageLayout',
  'app/core/views/NavbarView',
  'app/controller',
  'app/monitoring/routes',
  'app/diagnostics/routes',
  'app/analytics/routes',
  'app/events/routes',
  'app/alarms/routes',
  'app/users/routes',
  'app/dashboard/routes',
  'bootstrap',
  'moment-lang/' + (window.LOCALE || 'pl'),
  'i18n!app/nls/core'
],
function(
  domReady,
  $,
  Backbone,
  Layout,
  moment,
  monkeyPatch,
  broker,
  time,
  i18n,
  viewport,
  socket,
  router,
  PageLayout,
  NavbarView)
{
  'use strict';

  var startBroker = null;

  socket.connect();

  moment.locale(window.LOCALE || 'pl');

  $.ajaxSetup({
    dataType: 'json',
    accepts: {
      json: 'application/json',
      text: 'text/plain'
    },
    contentType: 'application/json'
  });

  Layout.configure({
    manage: true,
    el: false,
    keep: true
  });

  viewport.registerLayout('page', function createPageLayout()
  {
    var req = router.getCurrentRequest();

    return new PageLayout({
      views: {
        '.navbar': new NavbarView({
          currentPath: req === null ? '/' : req.path
        })
      }
    });
  });

  broker.subscribe('page.titleChanged', function(newTitle)
  {
    newTitle.unshift(i18n('core', 'TITLE'));

    document.title = newTitle.reverse().join(' < ');
  });

  if (navigator.onLine)
  {
    startBroker = broker.sandbox();

    startBroker.subscribe('user.reloaded', doStartApp);
    startBroker.subscribe('socket.connectFailed', doStartApp);
  }
  else
  {
    doStartApp();
  }

  function doStartApp()
  {
    if (startBroker !== null)
    {
      startBroker.destroy();
      startBroker = null;
    }

    var userReloadTimer = null;

    broker.subscribe('i18n.reloaded', function(message)
    {
      localStorage.setItem('LOCALE', message.newLocale);
      viewport.render();
    });

    broker.subscribe('user.reloaded', function()
    {
      if (userReloadTimer)
      {
        clearTimeout(userReloadTimer);
      }

      userReloadTimer = setTimeout(function()
      {
        userReloadTimer = null;

        var currentRequest = router.getCurrentRequest();

        viewport.render();

        router.dispatch(currentRequest.url);
      }, 1);
    });

    broker.subscribe('user.loggedIn', function()
    {
      if (userReloadTimer)
      {
        clearTimeout(userReloadTimer);
        userReloadTimer = null;
      }

      var req = router.getCurrentRequest();

      if (!req)
      {
        return;
      }

      viewport.render();

      var url = req.url;

      if (url === '/' || url === '/login')
      {
        router.dispatch(window.DASHBOARD_URL_AFTER_LOG_IN || '/');
      }
      else
      {
        router.dispatch(url);
      }
    });

    broker.subscribe('user.loggedOut', function()
    {
      viewport.msg.show({
        type: 'success',
        text: i18n('core', 'MSG:LOG_OUT:SUCCESS'),
        time: 2500
      });

      setTimeout(function()
      {
        broker.publish('router.navigate', {
          url: '/',
          trigger: true
        });
      }, 1);
    });

    domReady(function()
    {
      $('#app-loading').fadeOut(function() { $(this).remove(); });

      if (window.ENV)
      {
        document.body.classList.add('is-' + window.ENV + '-env');
      }

      Backbone.history.start({
        root: '/',
        hashChange: true,
        pushState: false
      });
    });
  }
});
