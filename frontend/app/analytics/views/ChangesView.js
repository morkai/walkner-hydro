define([
  'app/i18n',
  'app/core/View',
  'app/analytics/templates/changes',
  'i18n!app/nls/analytics'
], function(
  t,
  View,
  changesTemplate
) {
  'use strict';

  /**
   * @name app.users.views.ChangesView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var ChangesView = View.extend({

    template: changesTemplate,

    events: {
      'click tr': function(e)
      {
        var $tag =
          this.$(e.target).closest('tr').find('.analytics-changes-tag');

        if ($tag.length === 1)
        {
          this.broker.publish('router.navigate', {
            url: '/analytics/changes/' + $tag.text().trim(),
            trigger: true,
            replace: false
          });
        }
      }
    }

  });

  ChangesView.prototype.initialize = function()
  {
    this.listenTo(this.model, 'reset', this.render);
  };

  ChangesView.prototype.serialize = function()
  {
    return {
      groups: this.model.group()
    };
  };

  return ChangesView;
});
