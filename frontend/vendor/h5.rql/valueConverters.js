define(function (require, exports, module) {'use strict';

var autoConvertedMap = require('./autoConvertedMap');

module.exports = {
  default: autoConverter,
  auto: autoConverter,
  number: numberConverter,
  epoch: epochConverter,
  isodate: isodateConverter,
  date: dateConverter,
  boolean: booleanConverter,
  string: stringConverter,
  re: regExpConverter,
  glob: globConverter
};

/**
 * @param {string} str
 * @param {h5.rql.Parser} parser
 * @returns {*}
 */
function autoConverter(str, parser)
{
  if (autoConvertedMap.hasOwnProperty(str))
  {
    return autoConvertedMap[str];
  }

  var num = +str;

  if (isNaN(num) || num.toString() !== str)
  {
    str = decodeURIComponent(str);

    if (parser.options.jsonQueryCompatible)
    {
      if (str[0] === "'" && str[str.length - 1] === "'")
      {
        return JSON.parse('"' + str.substring(1, str.length - 1) + '"');
      }
    }

    return str;
  }

  return num;
}

/**
 * @param {string} str
 * @returns {number}
 * @throws {Error}
 */
function numberConverter(str)
{
  var num = +str;

  if (isNaN(num))
  {
    throw new Error("Invalid number: " + str);
  }

  return num;
}

/**
 * @param {string} str
 * @returns {Date}
 * @throws {Error}
 */
function epochConverter(str)
{
  var date = new Date(+str);

  if (isNaN(date.getTime()))
  {
    throw new Error("Invalid date: " + str);
  }

  return date;
}

/**
 * @param {string} str
 * @returns {Date}
 * @throws {Error}
 */
function isodateConverter(str)
{
  str = decodeURIComponent(str);
  str = '0000'.substr(0, 4 - str.length) + str;
  str += '0000-01-01T00:00:00Z'.substring(str.length);

  return dateConverter(str);
}

/**
 * @param {string} str
 * @returns {Date}
 * @throws {Error}
 */
function dateConverter(str)
{
  str = decodeURIComponent(str);

  var isoDate =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(str);
  var date;

  if (isoDate !== null)
  {
    date = new Date(Date.UTC(
      +isoDate[1],
      +isoDate[2] - 1,
      +isoDate[3],
      +isoDate[4],
      +isoDate[5],
      +isoDate[6]
    ));
  }
  else
  {
    date = new Date(str);
  }

  if (isNaN(date.getTime()))
  {
    throw new Error("Invalid date: " + str);
  }

  return date;
}

/**
 * @param {string} str
 * @returns {boolean}
 */
function booleanConverter(str)
{
  return str ? true : false;
}

/**
 * @param {string} str
 * @returns {string}
 */
function stringConverter(str)
{
  return decodeURIComponent(str);
}

/**
 * @param {string} str
 * @returns {RegExp}
 */
function regExpConverter(str)
{
  str = decodeURIComponent(str);

  var pattern = str;
  var modifiers = '';

  if (str[0] === '/')
  {
    var modPos = str.lastIndexOf('/');

    pattern = str.substr(1, modPos - 1);
    modifiers = str.substr(modPos + 1);
  }

  return new RegExp(pattern, modifiers);
}

/**
 * @param {string} str
 * @returns {RegExp}
 */
function globConverter(str)
{
  str = decodeURIComponent(str)
    .replace(/([\\\|\(\)\[\]\{\}\^\$\*\+\?\.<>])/g, '\\$1')
    .replace(/\\\*/g, '.*')
    .replace(/\\\?/g, '.?');

  str = str.substr(0, 2) === '.*' ? str.substr(2) : ('^' + str);

  str = str.substr(str.length - 2) === '.*'
    ? str.substr(0, str.length - 2)
    : (str + '$');

  return new RegExp(str, 'i');
}

});
