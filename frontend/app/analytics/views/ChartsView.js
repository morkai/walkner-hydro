// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'jquery',
  'moment',
  'app/core/View',
  'app/analytics/templates/charts',
  'i18n!app/nls/analytics',
  'flot',
  'flot.time',
  'flot.crosshair'
], function(
  _,
  $,
  moment,
  View,
  chartsTemplate
) {
  'use strict';

  var DATETIME_FORMAT = 'YYYY-MM-DD';
  var LEGEND_FORMAT = {
    minutely: 'LLLL',
    hourly: 'LLLL',
    daily: 'LL',
    monthly: 'MMMM YYYY'
  };

  /**
   * @name app.analytics.views.ChartsView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var ChartsView = View.extend({

    template: chartsTemplate,

    events: {
      'submit .analytics-charts-controls': function()
      {
        this.addCurrentSeries();

        return false;
      },
      'click .btn-danger': function()
      {
        this.tags = {};
        this.plotSeries = [];

        this.renderPlot();

        return false;
      },
      'plothover .analytics-charts-plot': function(e, pos)
      {
        this.latestPosition = pos;

        if (this.timers.updateLegend == null)
        {
          this.timers.updateLegend = setTimeout(this.updateLegend, 1000 / 30);
        }
      }
    }

  });

  ChartsView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('chart');

    /**
     * @private
     * @type {function}
     */
    this.adjustSize = _.throttle(this.adjustSize.bind(this), 100);

    /**
     * @private
     * @type {function}
     */
    this.updateLegend = this.updateLegend.bind(this);

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$legendLabels = null;

    /**
     * @private
     * @type {object|null}
     */
    this.latestPosition = null;

    /**
     * @private
     * @type {object}
     */
    this.tags = {};

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
     * @type {number}
     */
    this.interval = 'minutely';

    /**
     * @private
     * @type {Array}
     */
    this.plotSeries = [];

    /**
     * @private
     * @type {object}
     */
    this.plotOptions = {
      xaxis: {
        mode: 'time',
        timezone: 'browser',
        autoscaleMargin: 0.002,
        monthNames: moment().localeData()._monthsShort, // eslint-disable-line no-underscore-dangle
        dayNames: moment().localeData()._weekdaysMin // eslint-disable-line no-underscore-dangle
      },
      legend: {
        show: true,
        position: 'nw'
      },
      series: {
        lines: {
          show: true,
          steps: true
        }
      },
      crosshair: {
        mode: 'x'
      },
      grid: {
        hoverable: true,
        autoHighlight: false,
        margin: 0
      }
    };

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$plot = null;

    /**
     * @private
     * @type {object|null}
     */
    this.plot = null;

    $(window).on('resize', this.adjustSize);
  };

  ChartsView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      from: moment().subtract(1, 'days').format(DATETIME_FORMAT),
      to: moment().format(DATETIME_FORMAT)
    };
  };

  ChartsView.prototype.afterRender = function()
  {
    this.$plot = this.$('.analytics-charts-plot');

    var chartsView = this;

    this.timers.renderPlot = _.defer(function()
    {
      chartsView.adjustSize();
      chartsView.renderPlot();
    });
  };

  ChartsView.prototype.destroy = function()
  {
    $(window).off('resize', this.adjustSize);

    this.plot.shutdown();
    this.plot = null;

    this.$legendLabels.remove();
    this.$legendLabels = null;

    this.$plot.remove();
    this.$plot = null;

    this.tags = null;

    if (this.req)
    {
      this.req.abort();
      this.req = null;
    }
  };

  /**
   * @private
   */
  ChartsView.prototype.adjustSize = function()
  {
    this.$plot
      .height(
        window.innerHeight
          - $('.navbar').outerHeight(true)
          - $('.page-header').outerHeight(true)
          - $('.analytics-charts-controls').outerHeight(true)
          - $('.ft').outerHeight(true)
          - 10
      )
      .width(this.$el.width());

    if (this.plot !== null)
    {
      this.plot.resize();
      this.plot.setupGrid();
      this.plot.draw();

      this.prepareLegendLabels();
    }
  };

  /**
   * @private
   */
  ChartsView.prototype.renderPlot = function()
  {
    this.plot = $.plot(this.$plot, this.plotSeries, this.plotOptions);

    this.prepareLegendLabels();
  };

  /**
   * @private
   */
  ChartsView.prototype.prepareLegendLabels = function()
  {
    this.$legendLabels = this.$('.legendLabel');
    this.$legendTime = this.$('.legend table')
      .prepend('<tbody><tr><td colspan="2">?</td></tr>')
      .find('td')
      .first();
  };

  /**
   * @private
   */
  ChartsView.prototype.addCurrentSeries = function()
  {
    var $tag = this.$('#' + this.idPrefix + '-controls-tag');
    var tag = $tag.val();

    if (tag === '')
    {
      return;
    }

    var $from = this.$('#' + this.idPrefix + '-controls-from');
    var $to = this.$('#' + this.idPrefix + '-controls-to');

    var from = moment($from.val(), 'YYYY-MM-DD');
    var to = moment($to.val(), 'YYYY-MM-DD');

    if (!from)
    {
      $from.val('');
    }

    if (!to)
    {
      $to.val('');
    }

    if (!from || !to)
    {
      return;
    }

    var start = from.valueOf();
    var stop = to.valueOf();
    var interval = this.$('button[name="interval"].active').val();
    var diffFilter = start !== this.start || stop !== this.stop || interval !== this.interval;

    if (!diffFilter && _.isObject(this.tags[tag]))
    {
      return;
    }

    var $plot = this.$('#' + this.idPrefix + '-controls-plot').attr('disabled', true);

    $from.val(from.format(DATETIME_FORMAT));
    $to.val(to.format(DATETIME_FORMAT));

    var chartsView = this;

    this.req = $.ajax({
      type: 'GET',
      url: '/tags/' + tag + '/metric',
      data: {
        start: start,
        stop: stop,
        interval: interval,
        valueField: $tag[0].selectedOptions[0].getAttribute('data-value-field')
      }
    });

    this.req.done(function(res)
    {
      if (diffFilter)
      {
        chartsView.tags = {};
        chartsView.plotSeries = [];
        chartsView.start = start;
        chartsView.stop = stop;
        chartsView.interval = interval;
      }

      start = res.firstTime - res.step;

      var mul = tag === 'inputPumps.1.waterLevel' || tag === 'inputPumps.2.waterLevel' ? -1 : 1;

      var series = {
        label: $tag[0].selectedOptions[0].label + ' = <code>?</code>',
        data: res.values.map(function(value)
        {
          start += res.step;

          return [start, value === null ? null : (value * mul)];
        })
      };

      chartsView.plotSeries.push(series);
      chartsView.renderPlot();

      chartsView.tags[tag] = series;
    });

    this.req.always(function()
    {
      $plot.attr('disabled', false);

      chartsView.req = null;
    });
  };

  /**
   * @private
   */
  ChartsView.prototype.updateLegend = function()
  {
    this.timers.updateLegend = null;

    var pos = this.latestPosition;
    var axes = this.plot.getAxes();

    if (pos.x < axes.xaxis.min
      || pos.x > axes.xaxis.max
      || pos.y < axes.yaxis.min
      || pos.y > axes.yaxis.max)
    {
      return;
    }

    var data = this.plot.getData();
    var x = null;

    for (var i = 0; i < data.length; ++i)
    {
      var series = data[i];
      var j = 0;

      for (; j < series.data.length; ++j)
      {
        if (series.data[j][0] > pos.x)
        {
          break;
        }
      }

      var x = null;
      var y = null;
      var p1 = series.data[j - 1];
      var p2 = series.data[j];

      if (p1 != null)
      {
        x = p1[0];
        y = p1[1];
      }
      else if (p2 != null)
      {
        x = p2[0];
        y = p2[1];
      }

      /*
      if (p1 == null)
      {
        y = p2 ? p2[1] : null;
      }
      else if (p2 == null)
      {
        y = p1[1];
      }
      else if (p1[1] !== null && p2[1] !== null)
      {
        y = p1[1] + (p2[1] - p1[1]) * (pos.x - p1[0]) / (p2[0] - p1[0]);
      }
      */

      var value = y === null ? '?' : y.toFixed(2);

      this.$legendLabels.eq(i).find('code').text(value);
    }

    if (data.length)
    {
      this.$legendTime.text(moment(x).format(LEGEND_FORMAT[this.interval]));
    }
  };

  return ChartsView;
});
