'use strict';

var lodash = require('lodash');

module.exports = wrapAmd;

/**
 * @param {string} js
 * @param {object.<string, string>} [modules]
 * @returns {string}
 */
function wrapAmd(js, modules)
{
  var moduleArgs;
  var modulePaths;

  if (lodash.isObject(modules))
  {
    moduleArgs = lodash.keys(modules).join(', ');
    modulePaths = JSON.stringify(lodash.values(modules));
  }
  else
  {
    moduleArgs = '';
    modulePaths = '[]';
  }

  var wrappedJs = [
    'define(' + modulePaths + ', function(' + moduleArgs + ') {',
    js,
    '});'
  ];

  return wrappedJs.join('\n');
}
