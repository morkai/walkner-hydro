// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'app/broker',
  'app/core/Viewport'
], function(
  broker,
  Viewport
) {
  'use strict';

  var viewport = new Viewport({
    el: document.body,
    selector: '#app-viewport'
  });

  broker.subscribe('router.executing', function()
  {
    window.scrollTo(0, 0);
  });

  window.viewport = viewport;

  return viewport;
});
