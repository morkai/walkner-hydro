// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');

module.exports = wrapAmd;

/**
 * @param {string} js
 * @param {object.<string, string>} [modules]
 * @returns {string}
 */
function wrapAmd(js, modules)
{
  let moduleArgs;
  let modulePaths;

  if (_.isObject(modules))
  {
    moduleArgs = _.keys(modules).join(', ');
    modulePaths = JSON.stringify(_.values(modules));
  }
  else
  {
    moduleArgs = '';
    modulePaths = '[]';
  }

  const wrappedJs = [
    'define(' + modulePaths + ', function(' + moduleArgs + ') {',
    js,
    '});'
  ];

  return wrappedJs.join('\n');
}
