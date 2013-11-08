define([
  './broker',
  './core/Viewport'
], function(
  broker,
  Viewport
) {
  'use strict';

  var viewport = new Viewport({
    el: document.body,
    selector: '.viewport'
  });

  broker.subscribe('i18n.reloaded', function()
  {
    viewport.render();
  });

  broker.subscribe('router.executing', function()
  {
    window.scrollTo(0, 0);
  });

  return viewport;
});
