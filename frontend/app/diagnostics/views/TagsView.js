define([
  'underscore',
  'jquery',
  'moment',
  'app/i18n',
  'app/controller',
  'app/viewport',
  'app/core/View',
  'app/diagnostics/templates/tags',
  'app/tags/TagsCollection',
  'i18n!app/nls/diagnostics',
  'jquery.transit'
], function(
  _,
  $,
  moment,
  t,
  controller,
  viewport,
  View,
  tagsTemplate,
  TagsCollection
) {
  'use strict';

  /**
   * @name app.diagnostics.views.TagsView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var TagsView = View.extend({

    template: tagsTemplate,

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        _.each(changes, this.updateState, this);
      }
    },

    remoteTopics: {
      'controller.tagsChanged': function(tags)
      {
        this.tags.reset(tags);
      }
    },

    events: {
      'click .tag-value': function(e)
      {
        this.setTagValue($(e.target));
      },
      'click th': function(e)
      {
        this.sort($(e.target).attr('data-sort-property'));
      }
    }

  });

  TagsView.prototype.initialize = function()
  {
    this.tags = new TagsCollection();

    this.listenTo(this.tags, 'reset', this.render);
    this.listenTo(this.tags, 'sort', this.render);

    this.tags.fetch({reset: true});
  };

  TagsView.prototype.serialize = function()
  {
    var formatValue = this.formatValue.bind(this);

    return {
      tags: this.tags.map(function(tag)
      {
        tag = tag.toJSON();
        tag.value = formatValue(controller.values[tag.name], tag.type);

        if (tag.unit === null || tag.unit === -1)
        {
          tag.unit = '-';
        }

        if (tag.address === null || tag.address === -1)
        {
          tag.address = '-';
        }

        return tag;
      })
    };
  };

  TagsView.prototype.destroy = function()
  {
    this.tags = null;
  };

  /**
   * @private
   * @param {string} property
   */
  TagsView.prototype.sort = function(property)
  {
    this.tags.comparator = function(a, b)
    {
      if (a.get(property) < b.get(property))
      {
        return -1;
      }
      else if (a.get(property) > b.get(property))
      {
        return 1;
      }
      else
      {
        return 0;
      }
    };

    this.tags.sort();
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  TagsView.prototype.updateState = function(newValue, tagName)
  {
    var $tagValue = this.$('tr[data-tag="' + tagName + '"] .tag-value');

    if ($tagValue.length === 0 || $tagValue.is('.tag-changing'))
    {
      return;
    }

    $tagValue.removeClass('highlight');
    $tagValue.text(
      this.formatValue(newValue, this.tags.get(tagName).get('type'))
    );

    _.defer(function() { $tagValue.addClass('highlight'); });
  };

  /**
   * @private
   * @param {*} value
   * @param {string} type
   */
  TagsView.prototype.formatValue = function(value, type)
  {
    /*jshint -W015*/

    switch (type)
    {
      case 'time':
        return moment(value || 0).format('YYYY-MM-DD HH:mm:ss');

      default:
        return value === null || typeof value === 'undefined'
          ? '?'
          : String(value);
    }
  };

  /**
   * @private
   * @param {jQuery} $tagValue
   */
  TagsView.prototype.setTagValue = function($tagValue)
  {
    if ($tagValue.hasClass('tag-changing')
      || $tagValue.hasClass('tag-not-writable'))
    {
      return;
    }

    $tagValue.addClass('tag-changing');

    var tagName = $tagValue.closest('tr').attr('data-tag');
    var tag = this.tags.get(tagName);

    if (tag.get('type') === 'bool')
    {
      this.setBoolValue($tagValue, tagName, !controller.values[tagName]);
    }
    else
    {
      this.showEditor(tag, $tagValue);
    }
  };

  /**
   * @private
   * @param {jQuery} $tagValue
   * @param {string} tagName
   * @param {boolean} newValue
   */
  TagsView.prototype.setBoolValue =
    function($tagValue, tagName, newValue)
  {
    var view = this;

    controller.setValue(tagName, newValue, function(err)
    {
      if (err)
      {
        view.showErrorMessage(err, tagName, newValue);
      }

      $tagValue.removeClass('tag-changing');
    });
  };

  /**
   * @private
   * @param {Tag} tag
   * @param {jQuery} $tagValue
   */
  TagsView.prototype.showEditor = function(tag, $tagValue)
  {
    var pos = $tagValue.position();

    var $form = $('<form class="input-append"></form>')
      .css({
        position: 'absolute',
        top: pos.top + 4 + 'px',
        left: pos.left + 4 + 'px',
        width: $tagValue.outerWidth() + 'px'
      });

    var $value = $('<input class="span2" name="value" type="text">');

    $form.append($value.val(controller.values[tag.get('name')]));
    $form.append('<input class="btn" type="submit" value="&gt;">');

    var view = this;

    $form.submit(function()
    {
      var rawValue = $value.val().trim();
      var newValue;

      if (/^[0-9]+$/.test(rawValue))
      {
        newValue = parseInt(rawValue, 10);
      }
      else if (/^[0-9]+\.[0-9]+$/.test(rawValue))
      {
        newValue = parseFloat(rawValue);
      }
      else
      {
        newValue = rawValue;
      }

      var tagName = tag.get('name');

      controller.setValue(tagName, newValue, function(err)
      {
        if (err)
        {
          view.showErrorMessage(err, tagName, newValue);
        }

        $tagValue.removeClass('tag-changing');
      });

      $form.fadeOut(function() { $form.remove(); });

      return false;
    });

    $value.on('keyup', function(e)
    {
      if (e.which === 27)
      {
        $tagValue.removeClass('tag-changing');

        $form.fadeOut(function() { $form.remove(); });

        return false;
      }
    });

    $tagValue.append($form);

    $value.select();
  };

  /**
   * @private
   * @param {object} err
   * @param {string} tagName
   * @param {*} value
   */
  TagsView.prototype.showErrorMessage = function(err, tagName, value)
  {
    viewport.msg.show({
      time: 3000,
      type: 'error',
      text: t('diagnostics', 'TAG_WRITE_FAILED', {
        tag: tagName,
        value: value,
        reason: t('diagnostics', err.code || err.message)
      })
    });
  };

  return TagsView;
});
