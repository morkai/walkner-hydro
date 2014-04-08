// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'jquery',
  'backbone',
  '../broker',
  '../pubsub',
  '../socket',
  './util'
], function(
  _,
  $,
  Backbone,
  broker,
  socket,
  pubsub,
  util
) {
  'use strict';

  /**
   * @name app.core.Page
   * @constructor
   * @param {object} [options]
   */
  function Page(options)
  {
    this.options = options || {};

    util.defineSandboxedProperty(this, 'broker', broker);
    util.defineSandboxedProperty(this, 'socket', socket);
    util.defineSandboxedProperty(this, 'pubsub', pubsub);

    util.subscribeTopics(this, 'broker', this.topics, true);
    util.subscribeTopics(this, 'pubsub', this.remoteTopics, true);

    if (_.isFunction(this.breadcrumbs))
    {
      this.breadcrumbs = this.breadcrumbs.bind(this);
    }

    if (_.isFunction(this.actions))
    {
      this.actions = this.actions.bind(this);
    }

    if (_.isFunction(this.initialize))
    {
      this.initialize(this.options);
    }
  }

  Page.extend = Backbone.View.extend;

  Page.prototype.render = function()
  {

  };

  return Page;
});
