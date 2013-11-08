define([
  'underscore',
  'app/controller',
  '../util'
], function(
  _,
  controller,
  util
) {
  'use strict';

  var IS_MSIE = window.navigator.userAgent.indexOf('MSIE') !== -1;

  return {

    /**
     * @param {string} selector
     * @param {boolean} newState
     * @param {string} [className]
     */
    toggleElement: function(selector, newState, className)
    {
      var el = this.el.querySelectorAll(selector);

      if (el.length > 0)
      {
        util[newState ? 'addClass' : 'removeClass'](
          el, className || 'el-active'
        );
      }
    },

    /**
     * @param {number} currentValue
     * @param {number} maxValue
     * @returns {number}
     */
    calculateFillLevel: function(currentValue, maxValue)
    {
      if (currentValue == null || maxValue == null)
      {
        return 0;
      }

      return maxValue > 0 ? Math.round(currentValue * 100 / maxValue) : 0;
    },

    /**
     * @param {SVGGradientElement} fillEl
     * @param {number|string} capacityOrTag
     * @param {number|string} waterLevelOrTag
     * @param {boolean} [sub]
     */
    recalculateFillLevel: function(fillEl, capacityOrTag, waterLevelOrTag, sub)
    {
      var maxValue = typeof capacityOrTag === 'number'
        ? capacityOrTag
        : controller.getValue(capacityOrTag);
      var newValue = typeof waterLevelOrTag === 'number'
        ? waterLevelOrTag
        : controller.getValue(waterLevelOrTag);

      if (maxValue !== null && newValue !== null && sub)
      {
        newValue = maxValue - newValue;
      }

      this.setFillLevel(
        fillEl,
        this.calculateFillLevel(newValue, maxValue)
      );
    },

    /**
     * @param {SVGGradientElement} fillEl
     * @param {number} newLevel
     */
    setFillLevel: function(fillEl, newLevel)
    {
      if (newLevel == null)
      {
        return;
      }

      var newLevelPercent = 1 - newLevel / 100;
      var stops = fillEl.querySelectorAll('stop');

      if (stops.length >= 2)
      {
        stops[0].setAttribute('offset', newLevelPercent);
        stops[1].setAttribute('offset', newLevelPercent);
      }
    },

    /*
     * @param {SVGElement} el
     * @param {SVGElement} innerContainerEl
     * @param {string} positionTag
     * @param {string} capacityTag
     */
    setExtremes: function(el, innerContainerEl, positionTag, capacityTag)
    {
      var $el = this.$(el);

      var position = controller.getValue(positionTag);
      var maxCapacity = controller.getValue(capacityTag);

      if (!_.isNumber(position) || !_.isNumber(maxCapacity))
      {
        $el.hide();

        return;
      }

      $el.show();

      var maxY = innerContainerEl.getBBox().height;
      var elX = this.getTranslateValue($el[0]).x;
      var elY = Math.round(maxY - (maxY * position / maxCapacity));

      this.translateElement($el, elX, elY);
    },

    /**
     * @private
     * @param {SVGElement} el
     */
    getTranslateValue: function(el)
    {
      var transforms = el.transform.baseVal;

      for (var i = 0; i < transforms.numberOfItems; ++i)
      {
        var transform = transforms.getItem(i);

        if (transform.type === SVGTransform.SVG_TRANSFORM_TRANSLATE)
        {
          return {
            x: transform.matrix.e,
            y: transform.matrix.f
          };
        }
      }

      return {x: 0, y: 0};
    },

    /**
     * @private
     * @param {jQuery|Element} el
     * @param {number} x
     * @param {number} y
     */
    translateElement: function(el, x, y)
    {
      if (el instanceof Element)
      {
        el.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      }
      else if (IS_MSIE)
      {
        el.attr('transform', 'translate(' + x + ' ' + y + ')');
      }
      else
      {
        el.transition({x: x, y: y});
      }
    }

  };
});
