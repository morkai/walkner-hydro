define([
  'underscore',
  'jquery',
  'backbone.layout',
  './util',
  './views/MessagesView',
  'app/core/templates/dialog'
], function(
  _,
  $,
  Layout,
  util,
  MessagesView,
  dialogTemplate
) {
  'use strict';

  var removeLayoutView = Layout.prototype.removeView;
  var setLayoutView = Layout.prototype.setView;

  /**
   * @name app.core.Viewport
   * @constructor
   * @extends {Backbone.View}
   * @param {object} options
   * @param {h5.pubsub.Broker} options.broker
   */
  function Viewport(options)
  {
    Layout.call(this, options);

    /**
     * @type {app.views.MessagesView}
     */
    this.msg = options.messagesView
      ? options.messagesView
      : new MessagesView({el: this.el});

    /**
     * @private
     * @type {HTMLDocument}
     */
    this.document = options.document || window.document;

    /**
     * @private
     * @type {h5.pubsub.Broker}
     */
    this.broker = options.broker;

    /**
     * @private
     * @type {object.<string, Backbone.Layout>}
     */
    this.layouts = {};

    /**
     * @private
     * @type {Backbone.Layout|null}
     */
    this.currentLayout = null;

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$dialog = null;

    /**
     * @private
     * @type {Array.<Backbone.View|string|function>}
     */
    this.dialogQueue = [];

    /**
     * @private
     * @type {Backbone.View|null}
     */
    this.currentDialog = null;

    /**
     * @private
     * @type {function(jquery.Event)}
     */
    this.closeDialog = this.closeDialog.bind(this);

    this.$el.on('click', '.viewport-dialog .cancel', this.closeDialog);
  }

  util.inherits(Viewport, Layout);

  Viewport.prototype.cleanup = function()
  {
    this.broker.destroy();
    this.msg.remove();
    this.$dialog.remove();

    if (this.currentLayout)
    {
      this.currentLayout.remove();
    }

    if (this.currentDialog)
    {
      this.currentDialog.remove();
    }

    _.invoke(this.dialogQueue.filter(_.isObject), 'remove');
    _.invoke(this.layouts, 'remove');

    this.$el.off('click', '.viewport-dialog .cancel', this.closeDialog);

    this.broker = null;
    this.msg = null;
    this.$dialog = null;
    this.currentLayout = null;
    this.currentDialog = null;
    this.dialogQueue = null;
    this.layouts = null;
  };

  Viewport.prototype.afterRender = function()
  {
    if (this.$dialog !== null)
    {
      this.$dialog.remove();
    }

    this.$dialog = $(dialogTemplate()).appendTo(this.el).modal({
      show: false,
      backdrop: true
    });
    this.$dialog.on('hidden', this.onDialogHidden.bind(this));
  };

  /**
   * @param {string} name
   * @param {Backbone.Layout} layout
   * @returns {app.core.Viewport}
   */
  Viewport.prototype.registerLayout = function(name, layout)
  {
    this.layouts[name] = layout;

    return this;
  };

  /**
   * @param {string} layoutName
   * @returns {Backbone.Layout}
   */
  Viewport.prototype.useLayout = function(layoutName)
  {
    var newLayout = this.layouts[layoutName];

    if (_.isUndefined(newLayout))
    {
      throw new Error("Unknown layout: " + layoutName);
    }

    if (newLayout === this.currentLayout)
    {
      if (_.isFunction(this.currentLayout.reset))
      {
        this.currentLayout.reset();
      }

      return this.currentLayout;
    }

    var selector = this.options.selector || '';

    if (_.isObject(this.currentLayout))
    {
      removeLayoutView.call(this, selector);
    }

    this.currentLayout = newLayout;

    setLayoutView.call(this, selector, newLayout);

    if (!this.hasRendered)
    {
      this.render();
    }

    return this.currentLayout;
  };

  /**
   * @param {string|function|object} selector
   * @returns {Backbone.View}
   */
  Viewport.prototype.getView = function(selector)
  {
    if (this.currentLayout === null)
    {
      throw new Error("Cannot get a view without a layout.");
    }

    return this.currentLayout.getView(selector);
  };

  /**
   * @param {string|function|object} selector
   * @returns {underscore}
   */
  Viewport.prototype.getViews = function(selector)
  {
    if (this.currentLayout === null)
    {
      throw new Error("Cannot get views without a layout.");
    }

    return this.currentLayout.getViews(selector);
  };

  /**
   * @param {string} selector
   * @param {Backbone.View} view
   * @returns {Backbone.View}
   */
  Viewport.prototype.insertView = function(selector, view)
  {
    if (this.currentLayout === null)
    {
      throw new Error("Cannot insert a view without a layout.");
    }

    return this.currentLayout.insertView(selector, view);
  };

  /**
   * @param {object.<string, Backbone.View>} views
   * @returns {Backbone.Layout}
   */
  Viewport.prototype.insertViews = function(views)
  {
    if (this.currentLayout === null)
    {
      throw new Error("Cannot insert views without a layout.");
    }

    return this.currentLayout.insertViews(views);
  };

  /**
   * @param {object.<string, Backbone.View>} views
   * @returns {Backbone.Layout}
   */
  Viewport.prototype.setViews = function(views)
  {
    if (this.currentLayout === null)
    {
      throw new Error("Cannot set views without a layout.");
    }

    return this.currentLayout.setViews(views);
  };

  /**
   * @param {string} selector
   * @param {Backbone.View} view
   * @returns {Backbone.View}
   */
  Viewport.prototype.setView = function(selector, view)
  {
    if (this.currentLayout === null)
    {
      throw new Error("Cannot set a view without a layout.");
    }

    return this.currentLayout.setView(selector, view);
  };

  /**
   * @param {string|function|object} selector
   * @returns {underscore}
   */
  Viewport.prototype.removeView = function(selector)
  {
    if (this.currentLayout === null)
    {
      throw new Error("Cannot remove views without a layout.");
    }

    return this.currentLayout.removeView(selector);
  };

  /**
   * @param {Backbone.View} dialogView
   * @param {string|function} [title]
   * @returns {app.core.Viewport}
   */
  Viewport.prototype.showDialog = function(dialogView, title)
  {
    if (this.currentDialog !== null)
    {
      this.dialogQueue.push(dialogView, title);

      return this;
    }

    dialogView.render();

    this.currentDialog = dialogView;

    var $header = this.$dialog.find('.modal-header');

    if (title)
    {
      $header.find('.modal-title').text(title);
      $header.show();
    }
    else
    {
      $header.hide();
    }

    this.$dialog.find('.modal-body').empty().append(dialogView.el);
    this.$dialog.modal('show');

    return this;
  };

  /**
   * @param {jQuery.Event} [e]
   * @returns {app.core.Viewport}
   */
  Viewport.prototype.closeDialog = function(e)
  {
    if (this.currentDialog === null)
    {
      return this;
    }

    this.$dialog.modal('hide');

    if (e)
    {
      e.preventDefault();
    }

    return this;
  };

  /**
   * @private
   */
  Viewport.prototype.onDialogHidden = function()
  {
    if (_.isFunction(this.currentDialog.remove))
    {
      this.currentDialog.remove();
    }

    this.currentDialog = null;

    if (this.dialogQueue.length)
    {
      this.showDialog(this.dialogQueue.shift(), this.dialogQueue.shift());
    }
  };

  return Viewport;
});
