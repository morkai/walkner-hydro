define([
  'underscore',
  'jquery',
  'app/controller',
  'app/core/View',
  'i18n!app/nls/diagnostics',
  'jquery.transit'
], function(
  _,
  $,
  controller,
  View
) {
  'use strict';

  /**
   * @name app.diagnostics.views.CabinetView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var CabinetView = View.extend({

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        _.each(changes, this.updateState, this);
      }
    }

  });

  CabinetView.prototype.initialize = function()
  {
    this.tags = {};
  };

  CabinetView.prototype.destroy = function()
  {
    this.tags = null;
  };

  CabinetView.prototype.afterRender = function()
  {
    var $tags = this.$('img[data-tag]');
    var diagnosticsView = this;

    $tags.each(function()
    {
      var $img = $(this);

      var tag = {
        name: $img.attr('data-tag'),
        $img: $img,
        type: $img.attr('data-type') || 'led'
      };

      diagnosticsView.tags[tag.name] = tag;

      diagnosticsView.updateState(
        controller.getValue(tag.name), tag.name, false
      );
    });
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   * @param {boolean} transition
   */
  CabinetView.prototype.updateState = function(newValue, tagName, transition)
  {
    /*jshint -W015*/

    if (/\.status$/.test(tagName))
    {
      var switchTag = tagName.replace(/\.status$/, '.switch');

      if (!controller.getValue(switchTag))
      {
        this.updateState(newValue ? 2 : 0, switchTag, transition);
      }
    }

    var tag = this.tags[tagName];

    if (typeof tag === 'undefined')
    {
      return;
    }

    var src = null;

    switch (tag.type)
    {
      case 'switch':
        var numericValue = Number(newValue);

        if (isNaN(numericValue))
        {
          numericValue = 0;
        }

        src ='/assets/img/switch.svg?value=' + numericValue;
        break;

      case 'led':
        src = '/assets/img/led.svg?color='
          + (newValue ? tag.$img.attr('data-on-color') : 'grey');
        break;
    }

    if (src !== null)
    {
      tag.$img.attr('src', src);
    }

    var $parent = tag.$img.parent();

    tag.$img.detach();
    tag.$img.prependTo($parent);

    if (transition !== false)
    {
      tag.$img
        .transitionStop()
        .transition({scale: newValue ? 1.2 : 0.8, duration: 300})
        .transition({scale: 1, duration: 100});
    }
  };

  return CabinetView;
});
