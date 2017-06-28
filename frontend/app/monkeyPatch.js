// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'jquery',
  'backbone',
  'bootstrap',
  'pathseg'
],
function(
  $,
  Backbone
) {
  'use strict';

  var originalSync = Backbone.sync;

  Backbone.sync = function(method, model, options)
  {
    options.syncMethod = method;

    return originalSync.call(this, method, model, options);
  };

  $.fn.modal.Constructor.prototype.enforceFocus = function() {};

  $.fn.modal.Constructor.prototype.escape = function()
  {
    if (this.isShown && this.options.keyboard)
    {
      this.$element.on(
        'keydown.dismiss.bs.modal',
        $.proxy(function(e)
        {
          if (e.which === 27)
          {
            this.hide();
          }
        }, this)
      );
    }
    else if (!this.isShown)
    {
      this.$element.off('keydown.dismiss.bs.modal');
    }
  };

  return {};
});
