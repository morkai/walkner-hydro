define([
  'moment',
  'app/i18n',
  'app/core/View',
  'app/core/views/PaginationView',
  'app/core/templates/list',
  'i18n!app/nls/analytics'
], function(
  moment,
  t,
  View,
  PaginationView,
  listTemplate
) {
  'use strict';

  /**
   * @name app.users.views.TagChangesView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var TagChangesView = View.extend({

    template: listTemplate

  });

  TagChangesView.prototype.initialize = function()
  {
    this.listenTo(this.model, 'reset', this.render);

    this.setView('.pagination', new PaginationView({
      model: this.model.paginationData
    }));
  };

  TagChangesView.prototype.serialize = function()
  {
    var avg = this.model.length > 0 && !isNaN(this.model.first().get('x'));

    var columns = [{id: 't', label: t('analytics', 'PROPERTY_TIME')}];

    if (avg)
    {
      columns.push(
        {id: 'v', label: t('analytics', 'PROPERTY_VALUE_AVG')},
        {id: 'n', label: t('analytics', 'PROPERTY_VALUE_MIN')},
        {id: 'x', label: t('analytics', 'PROPERTY_VALUE_MAX')}
      );
    }
    else
    {
      columns.push({id: 'v', label: t('analytics', 'PROPERTY_VALUE')});
    }

    return {
      className: 'analytics-changes-tag-list',
      columns: columns,
      rows: this.model.toJSON().map(function(row)
      {
        /*jshint -W015*/

        row.t = moment(row.t).format('YYYY-MM-DD HH:mm:ss');

        switch (typeof row.v)
        {
          case 'number':
            row.v = row.v.toFixed(2);
            break;

          case 'boolean':
            row.v = row.v ? 'TRUE' : 'FALSE';
            break;
        }

        return row;
      })
    };
  };

  return TagChangesView;
});
