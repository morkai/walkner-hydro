define(function (require, exports, module) {'use strict';

var Term = require('./Term');
var valueConverters = require('./valueConverters');

module.exports = Parser;

/**
 * @const
 * @type {RegExp}
 */
var validCharactersRegExp = /^[\w_\*\-\+\.\$:%]$/;

/**
 * @const
 * @type {RegExp}
 */
var slashedArraysRegExp = /[\+\*\$\-:\w%\._]*\/[\+\*\$\-:\w%\._\/]*/g;

/**
 * @const
 * @type {RegExp}
 */
var fiqlRegExp = new RegExp(
  '(\\([\\+\\*\\$\\-:\\w%\\._,]+\\)|[\\+\\*\\$\\-:\\w%\\._]*|)'
    + '([<>!]?=(?:[\\w]*=)?|>|<)(\\([\\+\\*\\$\\-:\\w%\\._,]+\\)'
    + '|[\\+\\*\\$\\-:\\w%\\._]*|)',
  'g'
);

/**
 * @const
 * @type {object.<string, string>}
 */
var operatorMap = {
  '=': 'eq',
  '==': 'eq',
  '>': 'gt',
  '>=': 'ge',
  '<': 'lt',
  '<=': 'le',
  '!=': 'ne'
};

/**
 * @name h5.rql.Parser
 * @constructor
 * @param {(h5.rql.Parser.Options|object)=} options
 */
function Parser(options)
{
  /**
   * @type {h5.rql.Parser.Options}
   */
  this.options = options instanceof Parser.Options
    ? options
    : new Parser.Options(options);
}

/**
 * @constructor
 * @param {object=} options
 */
Parser.Options = function(options)
{
  if (typeof options !== 'object' || options === null)
  {
    options = {};
  }

  /**
   * @type {boolean}
   */
  this.jsonQueryCompatible = options.jsonQueryCompatible === true;

  /**
   * @type {boolean}
   */
  this.fiqlCompatible = !options.hasOwnProperty('fiqlCompatible')
    || options.fiqlCompatible === true;

  /**
   * @type {boolean}
   */
  this.allowSlashedArrays = options.allowSlashedArrays === true;

  /**
   * @type {boolean}
   */
  this.allowEmptyValues = options.allowEmptyValues === true;

  /**
   * @type {function}
   */
  this.defaultValueConverter =
    typeof options.defaultValueConverter === 'function'
      ? options.defaultValueConverter
      : valueConverters.default;

  /**
   * @type {Array.<string>}
   */
  this.specialTerms = Array.isArray(options.specialTerms)
    ? options.specialTerms
    : [];

  /**
   * @type {*}
   */
  this.emptyValue = options.hasOwnProperty('emptyValue')
    ? options.emptyValue
    : '';
};

/**
 * @param {string} input
 * @param {object=} specialTerms
 * @returns {h5.rql.Term}
 * @throws {Error}
 */
Parser.prototype.parse = function(input, specialTerms)
{
  /*jshint maxstatements:999,-W015*/

  var collectSpecialTerms = typeof specialTerms === 'object'
    && specialTerms !== null;
  var specialTermsNames = this.options.specialTerms;

  var token = null;
  var term = new Term();
  var termsStack = [];
  var noValue = true;

  if (this.options.jsonQueryCompatible)
  {
    input = this.makeJsonQueryCompatible(input);
  }

  if (this.options.allowSlashedArrays)
  {
    input = this.convertSlashedArrays(input);
  }

  if (this.options.fiqlCompatible)
  {
    input = this.convertFiql(input);
  }

  for (var i = 0, l = input.length; i < l; ++i)
  {
    var chr = input[i];

    switch (chr)
    {
      case '(':
        termsStack.push(term);

        term = new Term(token);

        if (collectSpecialTerms
          && token !== null
          && specialTermsNames.indexOf(token) !== -1)
        {
          delete specialTerms[token];
          specialTerms[token] = term.args;
        }

        token = null;
        noValue = true;

        break;

      case ',':
        if (noValue === false)
        {
          if (this.options.allowEmptyValues)
          {
            token = this.options.emptyValue;
          }
          else
          {
            throw new Error(
              "Empty value at position " + i + " is not allowed."
            );
          }
        }

        if (token !== null)
        {
          term.args.push(this.convertStringToValue(token));

          token = null;
        }

        noValue = false;

        break;

      case ')':
        if (token !== null)
        {
          term.args.push(this.convertStringToValue(token));

          token = null;
        }

        var arg = term.name === null ? term.args : term;

        term = termsStack.pop();
        term.args.push(arg);

        noValue = true;

        break;

      case '&':
      case '|':
        var conjunction = chr === '&' ? 'and' : 'or';

        if (term.name !== null && term.name !== conjunction)
        {
          throw new Error(
            "Can not mix conjunctions within a group at position "
              + i + ", use parenthesises around each set of the same "
              + "conjunctions (& and |)"
          );
        }

        term.name = chr === '&' ? 'and' : 'or';

        if (token !== null)
        {
          term.args.push(this.convertStringToValue(token));

          token = null;
        }

        break;

      default:
        if (!validCharactersRegExp.test(chr))
        {
          throw new Error(
            "Invalid character at position " + i + ": '"
              + chr + "' (" + chr.charCodeAt(0) + ")"
          );
        }

        if (token === null)
        {
          token = chr;
        }
        else
        {
          token += chr;
        }

        noValue = true;

        break;
    }
  }

  if (token !== null)
  {
    term.args.push(this.convertStringToValue(token));
  }

  if (term.name === null)
  {
    term.name = 'and';
  }

  if (term.name === 'and'
    && term.args.length === 1
    && term.args[0] instanceof Term
    && term.args[0].name === 'and')
  {
    term = term.args[0];
  }

  return term;
};

/**
 * @private
 * @param {string} input
 * @returns {string}
 */
Parser.prototype.makeJsonQueryCompatible = function(input)
{
  if (this.options.jsonQueryCompatible)
  {
    input = input
      .replace(/%3C=/g, '=le=')
      .replace(/%3E=/g, '=ge=')
      .replace(/%3C/g, '=lt=')
      .replace(/%3E/g, '=gt=');
  }

  return input;
};

/**
 * Converts slash delimited text to arrays.
 *
 * @private
 * @param {string} input
 * @returns {string}
 */
Parser.prototype.convertSlashedArrays = function(input)
{
  if (input.indexOf('/') !== -1)
  {
    return input.replace(slashedArraysRegExp, function(slashed)
    {
      return '(' + slashed.replace(/\//g, ',') + ')';
    });
  }

  return input;
};

/**
 * @private
 * @param {string} input
 * @returns {string}
 */
Parser.prototype.convertFiql = function(input)
{
  return input.replace(fiqlRegExp, function(_, property, operator, value)
  {
    if (operator.length < 3)
    {
      operator = operatorMap[operator];
    }
    else
    {
      operator = operator.substring(1, operator.length - 1);
    }

    return operator + '(' + property + ',' + value + ')';
  });
};

/**
 * @private
 * @param {string} str
 * @returns {string}
 */
Parser.prototype.convertStringToValue = function(str)
{
  var converter;
  var colonPos = str.indexOf(':');

  if (colonPos !== -1)
  {
    var converterName = str.substr(0, colonPos);

    converter = valueConverters[converterName];

    if (typeof converter === 'undefined')
    {
      throw new Error("Unknown value converter: " + converterName);
    }

    str = str.substr(colonPos + 1);
  }
  else
  {
    converter = this.options.defaultValueConverter;
  }

  return converter(str, this);
};

});
