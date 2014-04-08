// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
