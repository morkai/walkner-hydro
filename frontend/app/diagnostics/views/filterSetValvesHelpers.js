// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/controller'
], function(
  controller
) {
  'use strict';

  var helpers = {};

  /**
   * @param {number} filterSet
   * @param {number} valve
   * @returns {boolean}
   */
  helpers.isOpen = v;

  /**
   * @param {number} filterSet
   * @returns {object.<string, string|null>}
   */
  helpers.getPathColors = function(filterSet)
  {
    var inputFlow = controller.getValue('inputFlow');
    var washingFlow = controller.getValue('washingFlow');
    var blowerStatus = controller.getValue('blower.status');

    var v1 = null;
    var v4 = null;
    var v5 = null;
    var v6 = null;
    var top = null;
    var bot = null;
    var settler = null;

    if (inputFlow)
    {
      v1 = 'rawWater';

      if (v(filterSet, 1))
      {
        top = v1;
        bot = 'cleanWater';

        if (v(filterSet, 2))
        {
          settler = top;
        }
        else if (v(filterSet, 3))
        {
          settler = bot;
        }

        if (v(filterSet, 4))
        {
          v4 = bot;
        }

        if (v(filterSet, 5))
        {
          v5 = bot;
        }

        if (v(filterSet, 6))
        {
          v6 = bot;
        }
      }
    }

    if (blowerStatus)
    {
      v4 = 'air';

      if (v(filterSet, 4))
      {
        bot = v4;
        top = 'dirtyWater';

        if (v(filterSet, 1))
        {
          v1 = top;
        }

        if (v(filterSet, 2))
        {
          settler = top;
        }

        if (v(filterSet, 3))
        {
          settler = bot;
        }

        if (v(filterSet, 5))
        {
          v5 = bot;
        }

        if (v(filterSet, 6))
        {
          v6 = bot;
        }
      }
    }

    if (washingFlow)
    {
      v6 = 'cleanWater';

      if (v(filterSet, 6))
      {
        bot = v6;
        top = 'dirtyWater';
      }

      if (v(filterSet, 1))
      {
        v1 = top;
      }

      if (v(filterSet, 2))
      {
        settler = top;
      }

      if (v(filterSet, 3))
      {
        settler = bot;
      }

      if (v(filterSet, 4))
      {
        v4 = bot;
      }

      if (v(filterSet, 5))
      {
        v5 = bot;
      }
    }

    return {
      v1: v1,
      v4: v4,
      v5: v5,
      v6: v6,
      top: top,
      bot: bot,
      settler: settler
    };
  };

  /**
   * @param {number} filterSet
   * @param {number} valve
   * @returns {boolean}
   */
  function v(filterSet, valve)
  {
    return controller.getValue(
      'filterSets.' + filterSet + '.valves.' + valve + '.status'
    );
  }

  return helpers;
});
