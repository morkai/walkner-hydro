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
  'app/broker',
  'app/time',
  'app/i18n',
  'app/viewport',
  'app/core/views/PageLayout',
  'app/core/views/NavbarView',
  'app/socket',
  'app/controller',
  'app/router',
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
  broker,
  time,
  i18n,
  viewport,
  PageLayout,
  NavbarView)
{
  'use strict';

  moment.lang(window.LOCALE || 'pl');

  broker.subscribe('page.titleChanged', function(newTitle)
  {
    newTitle.unshift(i18n('core', 'TITLE'));

    document.title = newTitle.reverse().join(' < ');
  });

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

  viewport.registerLayout('page', new PageLayout({
    views: {
      '.navbar': new NavbarView()
    }
  }));

  domReady(function()
  {
    $('.loading').fadeOut(function() { $(this).remove(); });

    Backbone.history.start({
      root: '/',
      hashChange: true,
      pushState: false
    });
  });
});
