define([
  'underscore',
  'jquery',
  'backbone.layout',
  '../broker',
  '../socket',
  '../pubsub',
  './util'
],
function(
  _,
  $,
  Layout,
  broker,
  socket,
  pubsub,
  util
) {
  'use strict';

  /**
   * @name app.core.View
   * @constructor
   * @extends {Backbone.Layout}
   * @param {object} [options]
   * @param {h5.pubsub.Broker} [options.broker]
   * @param {app.core.Socket} [options.socket]
   * @param {h5.pubsub.Broker} [options.pubsub]
   */
  function View(options)
  {
    util.defineSandboxedProperty(this, 'broker', broker);
    util.defineSandboxedProperty(this, 'socket', socket);
    util.defineSandboxedProperty(this, 'pubsub', pubsub);

    util.subscribeTopics(this, 'broker', this.topics, true);
    util.subscribeTopics(this, 'pubsub', this.remoteTopics, true);

    /**
     * @protected
     * @type {object.<string, number>}
     */
    this.timers = {};

    Layout.call(this, options);
  }

  util.inherits(View, Layout);

  View.prototype.cleanup = function()
  {
    util.cleanupSandboxedProperties(this);

    if (_.isObject(this.timers))
    {
      _.each(this.timers, clearTimeout);

      this.timers = null;
    }

    if (_.isFunction(this.destroy))
    {
      this.destroy();
    }
  };

  /**
   * @returns {boolean}
   */
  View.prototype.isRendered = function()
  {
    return this.hasRendered === true;
  };

  /**
   * @returns {boolean}
   */
  View.prototype.isDetached = function()
  {
    return !$.contains(document.documentElement, this.el);
  };

  return View;
});
