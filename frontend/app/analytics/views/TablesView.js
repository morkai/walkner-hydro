// Part of <http://miracle.systems/p/walkner-hydro> licensed under <CC BY-NC-SA 4.0>

define([
  'underscore',
  'jquery',
  'moment',
  'app/i18n',
  'app/core/View',
  'app/core/util/ExpandableSelect',
  'app/analytics/templates/tables',
  'app/analytics/templates/table',
  'i18n!app/nls/analytics'
], function(
  _,
  $,
  moment,
  t,
  View,
  ExpandableSelect,
  tablesTemplate,
  tableTemplate
) {
  'use strict';

  var DATETIME_FORMAT = 'YYYY-MM-DD';
  var NUMBER_SEPARATOR = (0.1).toLocaleString().substring(1, 2);

  function formatNumber(v, noSpaces)
  {
    if (v == null)
    {
      return '';
    }

    v = (Math.round(v * 100) / 100).toLocaleString().split(NUMBER_SEPARATOR);

    if (!v[1])
    {
      v[1] = '00';
    }
    else if (v[1].length === 1)
    {
      v[1] += '0';
    }

    if (noSpaces)
    {
      v[0] = v[0].replace(/ /g, '');
    }

    return v[0] + NUMBER_SEPARATOR + v[1];
  }

  /**
   * @name app.analytics.views.TablesView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var TablesView = View.extend({

    template: tablesTemplate,

    events: {
      'submit .analytics-tables-controls': function()
      {
        this.reload();

        return false;
      }
    }

  });

  TablesView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('tables');

    /**
     * @private
     * @type {number}
     */
    this.start = -1;

    /**
     * @private
     * @type {number}
     */
    this.stop = -1;

    /**
     * @private
     * @type {string}
     */
    this.interval = 'daily';

    /**
     * @private
     * @type {Object|null}
     */
    this.data = null;
  };

  TablesView.prototype.destroy = function()
  {
    this.$('.is-expandable').expandableSelect('destroy');
  };

  TablesView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      from: moment().subtract(14, 'days').format(DATETIME_FORMAT),
      to: moment().format(DATETIME_FORMAT)
    };
  };

  TablesView.prototype.afterRender = function()
  {
    this.$('.is-expandable').expandableSelect();
  };

  TablesView.prototype.reload = function()
  {
    var view = this;
    var tags = _.pluck(view.$('#' + this.idPrefix + '-controls-tag')[0].selectedOptions, 'value');
    var from = moment(view.$('#' + this.idPrefix + '-controls-from').val(), 'YYYY-MM-DD');
    var to = moment(view.$('#' + this.idPrefix + '-controls-from').val(), 'YYYY-MM-DD');
    var interval = view.$('button[name="interval"].active').val();

    if (!tags.length || !from.isValid() || !to.isValid())
    {
      return;
    }

    var $submit = view.$('#' + this.idPrefix + '-controls-submit').prop('disabled', true);

    view.req = $.ajax({
      type: 'GET',
      url: '/tags/avg',
      data: {
        tags: tags.join(','),
        start: from.valueOf(),
        to: to.valueOf(),
        interval: interval,
        fields: ''
      }
    });

    view.req.always(function()
    {
      $submit.attr('disabled', false);

      view.req = null;
    });

    view.req.done(function(res)
    {
      view.renderTable(tags, view.groupData(res));
    });
  };

  TablesView.prototype.groupData = function(data)
  {
    if (data.length === 0)
    {
      return [];
    }

    var groups = {};

    data.forEach(function(d)
    {
      if (!groups[d.time])
      {
        groups[d.time] = {
          time: moment(d.time),
          tags: {}
        };
      }

      groups[d.time].tags[d.tag] = d;
    });

    return Object
      .keys(groups)
      .sort(function(a, b) { return a - b; })
      .map(function(d) { return groups[d]; })
  };

  TablesView.prototype.renderTable = function(tags, rows)
  {
    var $container = this.$('.analytics-tables-table');

    if (!rows.length)
    {
      this.data = null;

      $container.html('<p class="well">' + t('analytics', 'NO_DATA') + '</p>');

      return;
    }

    var columns = _.intersection(tags, Object.keys(rows[0].tags));

    this.data = {
      columns: columns,
      rows: rows
    };

    $container.html(tableTemplate({
      num: formatNumber,
      columns: columns.map(function(c, i)
      {
        return {
          tag: c,
          evenOdd: i % 2 === 0 ? 'odd' : 'even'
        };
      }),
      rows: rows
    }));
  };

  TablesView.prototype.exportToCsv = function()
  {
    if (!this.data)
    {
      return;
    }

    var csv = ['time'];

    this.data.columns.forEach(function(column)
    {
      csv[0] += ';' + column + ';;;;;';
    });

    csv.push('');

    this.data.columns.forEach(function()
    {
      csv[1] += ';avg;min;max;davg;dmin;dmax';
    });

    this.data.rows.forEach(function(d)
    {
      var row = d.time.format('DD.MM.YYYY HH:mm:ss');

      this.data.columns.forEach(function(column)
      {
        column = d.tags[column];

        row += ';' + formatNumber(column.avg, true)
          + ';' + formatNumber(column.min, true)
          + ';' + formatNumber(column.max, true)
          + ';' + formatNumber(column.dAvg, true)
          + ';' + formatNumber(column.dMin, true)
          + ';' + formatNumber(column.dMax, true);
      });

      csv.push(row);
    }, this);

    var textbox = document.getElementById('textbox');
    var file = window.URL.createObjectURL(new Blob(['\ufeff' + csv.join('\r\n')], {type: 'text/plain'}));
    var a = document.createElement('a');

    a.setAttribute('download', 'HYDRO_' + moment().format('YYMMDD_HHMMSS') + '.csv');
    a.href = file;
    a.style.position = 'absolute';
    a.style.left = '-1000px';

    document.body.appendChild(a);

    window.requestAnimationFrame(function()
    {
      a.click();
      document.body.removeChild(a);
    });

    setTimeout(function()
    {
      window.URL.revokeObjectURL(file);
      file = null;
    }, 1337);
  };

  return TablesView;
});
