// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'jquery',
  'd3',
  'cubism',
  '../controller',
  '../core/util',
  '../core/View',
  '../core/views/SvgUtilMixin',
  'app/monitoring/templates/monitoring',
  'i18n!app/nls/monitoring',
  'i18n!app/nls/tags'
], function(
  _,
  $,
  d3,
  cubism,
  controller,
  util,
  View,
  SvgUtilMixin,
  monitoringTemplate
) {
  'use strict';

  /**
   * @name app.views.MonitoringView
   * @constructor
   * @extends {app.views.View}
   * @param {object} options
   * @param {object} options.model
   */
  var MonitoringView = View.extend({

    template: monitoringTemplate,

    topics: {
      'controller.tagValuesChanged': function(changes)
      {
        _.each(changes, this.updateState, this);
      }
    },

    events: {
      'click .el-tag': function(e)
      {
        this.toggleChart(
          $(e.target).closest('.el-tag').attr('data-tag'), e.ctrlKey
        );
      },
      'mouseenter .monitoring-charts': 'pauseChartSwitcher',
      'mouseleave .monitoring-charts': 'resumeChartSwitcher',
      'click .el-clickable': function(e)
      {
        var href = $(e.target).closest('.el-clickable').attr('data-href');

        if (href != null)
        {
          this.broker.publish('router.navigate', {
            url: href,
            trigger: true
          });
        }
      }
    }

  });

  _.extend(MonitoringView.prototype, SvgUtilMixin);

  MonitoringView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('monitoring');

    /**
     * @private
     * @type {object.<string, object>}
     */
    this.charts = {};

    /**
     * @private
     * @type {object|null}
     */
    this.currentChart = null;

    /**
     * @private
     * @type {object|null}
     */
    this.cubismContext = null;

    /**
     * @private
     * @type {object|null}
     */
    this.cubismRule = null;
  };

  MonitoringView.prototype.destroy = function()
  {
    _.each(
      this.charts,
      function(chart) { this.hideChart(chart, false); }, this
    );

    this.$('[data-original-title]').tooltip('destroy');

    this.charts = null;

    this.el.ownerDocument.body.style.backgroundColor = '';
  };

  MonitoringView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix
    };
  };

  MonitoringView.prototype.afterRender = function()
  {
    this.setUpTooltips();

    var monitoringView = this;

    _.defer(function()
    {
      monitoringView.setUpTags();
      monitoringView.setUpCharts();

      _.each(controller.values, monitoringView.updateState, monitoringView);
    });

    this.el.ownerDocument.body.style.backgroundColor = '#f5f5f5';
  };

  /**
   * @private
   */
  MonitoringView.prototype.setUpTooltips = function()
  {
    this.$('[title]').tooltip({
      container: this.el,
      delay: {show: 100, hide: 250}
    });
  };

  /**
   * @private
   */
  MonitoringView.prototype.setUpTags = function()
  {
    var tagEls = this.el.getElementsByClassName('el-tag');

    for (var i = 0, l = tagEls.length; i < l; ++i)
    {
      var tagEl = tagEls[i];
      var pattern = tagEl.getElementsByTagName('text')[0].textContent;

      tagEl.setAttribute('data-pattern', pattern);

      this.adjustTagSize(tagEl);
    }
  };

  /**
   * @private
   */
  MonitoringView.prototype.setUpCharts = function()
  {
    if (this.charts === null || _.size(this.charts) === 0)
    {
      return;
    }

    var currentChart = this.currentChart;
    var tagNames = Object.keys(this.charts);

    _.each(
      this.charts, function(chart) { this.hideChart(chart, false); }, this
    );
    _.each(
      tagNames, function(tagName) { this.showChart(tagName, false); }, this
    );

    this.bringChartToFront(this.charts[currentChart], false);
  };

  /**
   * @private
   * @param {HTMLElement} tagEl
   */
  MonitoringView.prototype.adjustTagSize = function(tagEl)
  {
    var rectEl = tagEl.getElementsByTagName('rect')[0];
    var textEl = tagEl.getElementsByTagName('text')[0];

    var textBBox = textEl.getBBox();

    rectEl.setAttribute('width', textBBox.width + 6);
    rectEl.setAttribute('height', textBBox.height + 3);
  };

  /**
   * @private
   * @param {*} newValue
   * @param {string} tagName
   */
  MonitoringView.prototype.updateState = function(newValue, tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case 'outputPressure':
      case 'compressorPressure':
      case 'inputFlow':
      case 'washingFlow':
      case 'outputFlow':
      case 'inputPumps.1.current':
      case 'inputPumps.2.current':
      case 'inputFlow.total.forwards':
      case 'washingFlow.total.forwards':
      case 'outputFlow.total.forwards':
      case 'outputPumps.presetRef':
      case 'outputPumps.current':
      case 'outputPumps.outputFrequency':
        this.setTagValue(tagName, newValue);
        break;

      case 'inputPumps.1.waterLevel':
        this.setTagValue(tagName, newValue);
        this.recalculateInputPumpFillLevel(1);
        break;

      case 'inputPumps.2.waterLevel':
        this.setTagValue(tagName, newValue);
        this.recalculateInputPumpFillLevel(2);
        break;

      case 'inputPumps.1.depth':
        this.recalculateInputPumpFillLevel(1);
        break;

      case 'inputPumps.2.depth':
        this.recalculateInputPumpFillLevel(2);
        break;

      case 'reservoirs.1.waterLevel':
        this.setTagValue(tagName, newValue);
        this.recalculateReservoirFillLevel(1);
        this.toggleReservoirExtremes(1);
        break;

      case 'reservoirs.2.waterLevel':
        this.setTagValue(tagName, newValue);
        this.recalculateReservoirFillLevel(2);
        this.toggleReservoirExtremes(2);
        break;

      case 'reservoirs.1.height':
        this.setReservoirExtremes(1, 'min');
        this.setReservoirExtremes(1, 'max');
        this.toggleReservoirExtremes(1);
        this.recalculateReservoirFillLevel(1);
        break;

      case 'reservoirs.2.height':
        this.setReservoirExtremes(2, 'min');
        this.setReservoirExtremes(2, 'max');
        this.toggleReservoirExtremes(2);
        this.recalculateReservoirFillLevel(2);
        break;

      case 'reservoirs.1.waterLevel.min':
        this.setReservoirExtremes(1, 'min');
        this.toggleReservoirExtremes(1);
        break;

      case 'reservoirs.1.waterLevel.max':
        this.setReservoirExtremes(1, 'max');
        this.toggleReservoirExtremes(1);
        break;

      case 'reservoirs.2.waterLevel.min':
        this.setReservoirExtremes(2, 'min');
        this.toggleReservoirExtremes(2);
        break;

      case 'reservoirs.2.waterLevel.max':
        this.setReservoirExtremes(2, 'max');
        this.toggleReservoirExtremes(2);
        break;

      case 'settler.height':
        this.setSettlerExtremes('min');
        this.setSettlerExtremes('max');
        break;

      case 'settler.min.height':
        this.setSettlerExtremes('min');
        break;

      case 'settler.max.height':
        this.setSettlerExtremes('max');
        break;

      case 'uvLamp.control':
        this.toggleElement('#' + this.idPrefix + '-uvLamp', !!newValue);
        break;

      case 'airValve.status':
        this.toggleElement(
          '#' + this.idPrefix + '-pneumaticDistributor', !!newValue
        );
        break;

      case 'outputPumps.1.status.vfd':
      case 'outputPumps.2.status.vfd':
      case 'outputPumps.3.status.vfd':
        this.highlightVfdOutputPump();
        break;

      default:
        var elName =
          tagName.replace(/\./g, '-').replace(/-(status|state)$/, '');
        var elSelector = '#' + this.idPrefix + '-' + elName;

        if (/\.status$/.test(tagName))
        {
          this.toggleElement(elSelector, newValue);
        }
        else if (/\.state$/.test(tagName))
        {
          this.toggleElement(elSelector, !newValue, 'el-disabled');
        }
        break;
    }
  };

  /**
   * @private
   * @param {number} index
   */
  MonitoringView.prototype.recalculateInputPumpFillLevel = function(index)
  {
    var fillEl = this.el.querySelector(
      '#' + this.idPrefix + '-inputPumps-' + index + '-waterLevel-fill'
    );
    var capacity = controller.getValue('inputPumps.' + index + '.depth.offset')
      + controller.getValue('inputPumps.' + index + '.depth.sensor');
    var waterLevelTag = 'inputPumps.' + index + '.waterLevel';

    this.recalculateFillLevel(fillEl, capacity, waterLevelTag, true);
  };

  /**
   * @private
   * @param {number} index
   */
  MonitoringView.prototype.recalculateReservoirFillLevel = function(index)
  {
    var fillEl = this.el.querySelector(
      '#' + this.idPrefix + '-reservoirs-' + index + '-waterLevel-fill'
    );
    var capacityTag = 'reservoirs.' + index + '.height';
    var waterLevelTag = 'reservoirs.' + index + '.waterLevel';

    this.recalculateFillLevel(fillEl, capacityTag, waterLevelTag, false);
  };

  /**
   * @private
   */
  MonitoringView.prototype.setSettlerExtremes = function(type)
  {
    var el = this.el.querySelector('#' + this.idPrefix + '-settler-' + type);
    var innerContainerEl =
      el.parentNode.querySelector('.el-settler-innerContainer');
    var positionTag = 'settler.' + type + '.height';
    var capacityTag = 'settler.height';

    this.setExtremes(el, innerContainerEl, positionTag, capacityTag);
  };

  /**
   * @private
   * @param {number} index
   */
  MonitoringView.prototype.toggleReservoirExtremes = function(index)
  {
    var waterLevelTag = 'reservoirs.' + index + '.waterLevel';
    var waterLevel = controller.getValue(waterLevelTag);

    this.toggleElement(
      '#' + this.idPrefix + '-reservoirs-' + index + '-min',
      waterLevel <= controller.getValue(waterLevelTag + '.min')
    );

    this.toggleElement(
      '#' + this.idPrefix + '-reservoirs-' + index + '-max',
      waterLevel >= controller.getValue(waterLevelTag + '.max')
    );
  };

  /**
   * @private
   */
  MonitoringView.prototype.setReservoirExtremes = function(index, type)
  {
    var el = this.el.querySelector(
      '#' + this.idPrefix + '-reservoirs-' + index + '-' + type
    );
    var innerContainerEl =
      el.parentNode.querySelector('.el-reservoir-innerContainer');
    var positionTag = 'reservoirs.' + index + '.waterLevel.' + type;
    var capacityTag = 'reservoirs.' + index + '.height';

    this.setExtremes(el, innerContainerEl, positionTag, capacityTag);
  };

  /**
   * @private
   * @param {string} tagName
   * @param {number} value
   */
  MonitoringView.prototype.setTagValue = function(tagName, value)
  {
    var tagEl = this.el.querySelector('.el-tag[data-tag="' + tagName + '"]');

    if (!tagEl)
    {
      return;
    }

    var pattern = tagEl.getAttribute('data-pattern');

    if (!pattern)
    {
      return;
    }

    var textEl = tagEl.getElementsByTagName('text')[0];

    if (!textEl)
    {
      return;
    }

    var oldValue = textEl.textContent.trim();
    var newValue = this.formatValue(value, pattern);

    textEl.textContent = newValue;

    if (newValue.length !== oldValue.length)
    {
      this.adjustTagSize(tagEl);
    }
  };

  /**
   * @private
   * @param {number} value
   * @param {string} pattern
   * @returns {string}
   */
  MonitoringView.prototype.formatValue = function(value, pattern)
  {
    pattern = pattern.split(' ');

    var numParts = pattern[0].split('.');
    var decimals = 0;

    if (numParts.length === 2)
    {
      decimals = numParts[1].length;
    }

    var padValue;

    if (typeof value === 'number')
    {
      value = value.toFixed(decimals);
      padValue = '\u00A0';
    }
    else
    {
      value = '?';
      padValue = '?';
    }

    while (value.length < pattern[0].length)
    {
      value = padValue + value;
    }

    return value + ' ' + pattern[1];
  };

  /**
   * @private
   * @param {string} tagName
   * @returns {number}
   */
  MonitoringView.prototype.getMaxValueForTag = function(tagName)
  {
    /*jshint -W015*/

    switch (tagName)
    {
      case 'inputPumps.1.waterLevel':
        return controller.getValue('inputPumps.1.depth.offset')
          + controller.getValue('inputPumps.1.depth.sensor');

      case 'inputPumps.2.waterLevel':
        return controller.getValue('inputPumps.2.depth.offset')
          + controller.getValue('inputPumps.2.depth.sensor');

      case 'reservoirs.1.waterLevel':
        return controller.getValue('reservoirs.1.height');

      case 'reservoirs.2.waterLevel':
        return controller.getValue('reservoirs.2.height');

      case 'inputPumps.1.current':
      case 'inputPumps.2.current':
      case 'outputPumps.current':
        return 15;

      case 'outputPumps.presetRef':
        return 100;

      case 'outputPumps.outputFrequency':
        return 60;

      case 'compressorPressure':
      case 'outputPressure':
        return 10;

      case 'inputFlow':
      case 'washingFlow':
      case 'outputFlow':
        return 100;

      case 'inputFlow.total.forwards':
      case 'washingFlow.total.forwards':
      case 'outputFlow.total.forwards':
        return Math.max(2000, Math.ceil(controller.getValue(tagName) * 1.5));

      default:
        return 0;
    }
  };

  /**
   * @private
   * @param {string} tagName
   * @param {boolean} bg
   */
  MonitoringView.prototype.toggleChart = function(tagName, bg)
  {
    if (_.isUndefined(this.charts[tagName]))
    {
      this.showChart(tagName);
    }
    else if (this.currentChart !== tagName)
    {
      if (bg)
      {
        this.hideChart(this.charts[tagName], true, true);
      }
      else
      {
        this.bringChartToFront(this.charts[tagName]);
      }
    }
    else
    {
      this.hideChart(this.charts[tagName]);
    }
  };

  /**
   * @private
   * @returns {cubismContext.context}
   */
  MonitoringView.prototype.getCubismContext = function()
  {
    if (this.cubismContext === null)
    {
      var size = this.el.ownerDocument.body.clientWidth;

      d3.select('.monitoring-charts-container')
        .style('width', size + 'px')
        .style('opacity', 1);

      var context = cubism.context()
        .serverDelay(5000)
        .clientDelay(0)
        .step(60 * 1000)
        .size(size);

      d3.select('.monitoring-charts').selectAll('.axis')
        .data(['top'])
        .enter()
        .append('div')
        .attr('class', function(d) { return d + ' axis'; })
        .each(function(d)
        {
          d3.select(this).call(
            context.axis()
              .ticks(d3.time.hours, 2)
              .tickFormat(d3.time.format('%H:%M'))
              .orient(d)
          );
        });

      this.cubismContext = context;
      this.cubismRule = context.cubismRule();

      d3.select('.monitoring-charts').append('div')
        .attr('class', 'rule')
        .call(this.cubismRule);
    }

    return this.cubismContext;
  };

  /**
   * @private
   * @param {object} chart
   * @returns {cubismContext.metric}
   */
  MonitoringView.prototype.createMetric = function(chart)
  {
    var tagName = chart.tagName;
    var first = true;
    var view = this;

    return this.getCubismContext().metric(function(start, stop, step, callback)
    {
      start = +start;
      stop = +stop;

      var url = '/tags/' + tagName + '/metric'
        + '?start=' + start
        + '&stop=' + stop
        + '&step=' + step;

      $.ajax({url: url, dataType: 'json'}).then(function(values)
      {
        if (!Array.isArray(values))
        {
          return callback(new Error("Failed to load data :("));
        }

        if (first)
        {
          first = false;

          var maxValueCount = (stop - start) / step;
          var missingValues =
            new Array(Math.max(0, maxValueCount - values.length));

          values.unshift.apply(values, missingValues);
        }

        if (tagName === 'inputPumps.1.waterLevel'
          || tagName === 'inputPumps.2.waterLevel')
        {
          var maxValue = view.getMaxValueForTag(tagName);

          values = values.map(function(value)
          {
            return value !== null ? maxValue - value : null;
          });
        }

        callback(null, values);
      });
    });
  };

  /**
   * @private
   * @param {string} tagName
   * @param {boolean} [transition] Defaults to `true`.
   */
  MonitoringView.prototype.showChart = function(tagName, transition)
  {
    if (!_.isUndefined(this.charts[tagName]))
    {
      return;
    }

    var tagEl = this.el.querySelector('.el-tag[data-tag="' + tagName + '"]');

    if (!tagEl)
    {
      return;
    }

    var view = this;
    var formatValue = d3.format('.2f');
    var format = tagName !== 'inputPumps.1.waterLevel'
      && tagName !== 'inputPumps.2.waterLevel'
        ? formatValue
        : function(value)
          {
            return formatValue(view.getMaxValueForTag(tagName) - value);
          };

    var title = tagEl.getAttribute('data-original-title') || '?';
    var color = tagEl.getAttribute('data-color') || '#999';
    var context = this.getCubismContext();
    var horizon = context.horizon()
      .title(title)
      .height(60)
      .colors([color, color])
      .format(format)
      .mode('offset')
      .extent([0, this.getMaxValueForTag(tagName)]);

    var chart = this.charts[tagName] = {
      tagName: tagName,
      horizon: horizon,
      rectEl: tagEl.getElementsByTagName('rect')[0]
    };

    chart.rectEl.style.fill = color;

    var tagMetric = this.createMetric(chart);

    d3.select('.monitoring-charts').call(function(charts)
    {
      charts.datum(tagMetric);

      charts.append('div')
        .attr('class', 'horizon')
        .attr('data-tag', tagName)
        .call(chart.horizon);
    });

    this.$el.css('margin-bottom', '65px');

    var window = this.el.ownerDocument.defaultView;

    window.scrollTo(window.scrollX, window.innerHeight);

    this.bringChartToFront(chart, transition);
  };

  /**
   * @private
   * @param {object} chart
   * @param {boolean} [transition] Defaults to `true`.
   */
  MonitoringView.prototype.bringChartToFront = function(chart, transition)
  {
    if (!chart || chart.tagName === this.currentChart)
    {
      return;
    }

    var $oldHorizon = null;

    if (this.currentChart !== null)
    {
      $oldHorizon = this.$('.horizon[data-tag="' + this.currentChart + '"]');
      $oldHorizon.css('z-index', 1);
    }

    this.$('.horizon[data-tag="' + chart.tagName + '"]')
      .css('z-index', 2)
      .transitionStop()
      .transition({y: -62, duration: transition === false ? 0 : 400}, function()
      {
        if ($oldHorizon !== null)
        {
          $oldHorizon
            .transitionStop()
            .transition({y: 0, duration: 0});
        }
      });

    this.currentChart = chart.tagName;

    this.resumeChartSwitcher();
  };

  /**
   * @private
   * @param {object} chart
   * @param {boolean} [transition] Defaults to `true`.
   * @param {boolean} [bg] Defaults to `false`.
   */
  MonitoringView.prototype.hideChart = function(chart, transition, bg)
  {
    var monitoringView = this;
    var $horizon = this.$('.horizon[data-tag="' + chart.tagName + '"]');

    function destroyChart()
    {
      d3.select($horizon[0])
        .call(chart.horizon.remove)
        .remove();

      chart.rectEl.style.fill = '';

      chart.horizon = null;
      chart.rectEl = null;

      delete monitoringView.charts[chart.tagName];
    }

    function destroyCubism()
    {
      d3.select('.rule')
        .call(monitoringView.cubismRule.remove)
        .remove();

      monitoringView.cubismContext.remove();

      monitoringView.cubismRule = null;
      monitoringView.cubismContext = null;
      monitoringView.currentChart = null;

      monitoringView.$el
        .css('margin-bottom', '0px')
        .find('.monitoring-charts')
        .empty()
        .parent()
        .css('width', '0px');
    }

    if (_.size(this.charts) > 1)
    {
      if (bg)
      {
        return destroyChart();
      }

      var $nextHorizon = $horizon.next('.horizon');

      if ($nextHorizon.length === 0)
      {
        $nextHorizon = $horizon.prev('.horizon');
      }

      var nextChart = this.charts[$nextHorizon.attr('data-tag')];

      if (transition === false)
      {
        destroyChart();
        monitoringView.bringChartToFront(nextChart, false);
      }
      else
      {
        $horizon.transitionStop().transition({y: 0}, function()
        {
          destroyChart();
          monitoringView.bringChartToFront(nextChart);
        });
      }
    }
    else
    {
      if (transition === false)
      {
        destroyChart();
        destroyCubism();
      }
      else
      {
        $horizon
          .closest('.monitoring-charts-container')
          .transitionStop()
          .transition({opacity: 0}, function()
          {
            destroyChart();
            destroyCubism();
          });
      }
    }
  };

  /**
   * @private
   */
  MonitoringView.prototype.pauseChartSwitcher = function()
  {
    if (this.timers.chartSwitcher !== null)
    {
      clearTimeout(this.timers.chartSwitcher);
      this.timers.chartSwitcher = null;
    }
  };

  /**
   * @private
   */
  MonitoringView.prototype.resumeChartSwitcher = function()
  {
    if (this.timers === null)
    {
      return;
    }

    this.pauseChartSwitcher();

    var $allHorizons = this.$('.horizon');

    if ($allHorizons.length === 1)
    {
      return;
    }

    var $currentHorizon =
      $allHorizons.filter('[data-tag="' + this.currentChart + '"]');
    var $nextHorizon = $currentHorizon.next('.horizon');

    if ($nextHorizon.length === 0)
    {
      $nextHorizon = $allHorizons.first();
    }

    var nextChart = this.charts[$nextHorizon.attr('data-tag')];
    var frontTime = Math.max(10000, Math.round(60000 / $allHorizons.length));

    this.timers.chartSwitcher = setTimeout(
      this.bringChartToFront.bind(this, nextChart),
      frontTime
    );
  };

  /**
   * @private
   */
  MonitoringView.prototype.highlightVfdOutputPump = function()
  {
    var $label = this.$('#' + this.idPrefix + '-outputPumps-vfd');
    var basePosition = $label.attr('data-base-position');

    if (!basePosition)
    {
      var translateValue = this.getTranslateValue($label[0]);

      basePosition = translateValue.x + ',' + translateValue.y;

      $label.attr('data-base-position', basePosition);
    }

    basePosition = basePosition.split(',').map(Number);

    var vfdRunning = -1;

    for (var i = 1; i <= 3; ++i)
    {
      if (controller.getValue('outputPumps.' + i + '.status.vfd'))
      {
        vfdRunning = i;

        break;
      }
    }

    if (vfdRunning === -1)
    {
      $label.hide();
    }
    else
    {
      $label.show();

      this.translateElement(
        $label, basePosition[0] + (i - 1) * 80, basePosition[1]
      );
    }
  };

  return MonitoringView;
});
