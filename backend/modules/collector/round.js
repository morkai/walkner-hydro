// Part of <https://miracle.systems/p/walkner-furmon> licensed under <CC BY-NC-SA 4.0>

'use strict';

/**
 * @param {?number} number
 * @returns {?number}
 */
module.exports = function round(number)
{
  return number === null || isNaN(number) || !isFinite(number) ? null : (Math.round(number * 10000) / 10000);
};
