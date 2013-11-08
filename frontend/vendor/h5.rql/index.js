define(function (require, exports, module) {'use strict';

var Term = require('./Term');
var Query = require('./Query');
var Parser = require('./Parser');
var specialTerms = require('./specialTerms');
var valueConverters = require('./valueConverters');

/**
 * @type {h5.rql.Term}
 */
exports.Term = Term;

/**
 * @type {h5.rql.Query}
 */
exports.Query = Query;

/**
 * @type {h5.rql.Parser}
 */
exports.Parser = Parser;

/**
 * @type {object.<string, function>}
 */
exports.specialTerms = specialTerms;

/**
 * @type {object.<string, function>}
 */
exports.valueConverters = valueConverters;

/**
 * @type {h5.rql.Parser|null}
 */
exports.parser = null;

/**
 * @param {string} queryString
 * @returns {h5.rql.Query}
 */
exports.parse = function parseQueryStringToRqlQuery(queryString)
{
  if (exports.parser === null)
  {
    exports.parser = new Parser({
      jsonQueryCompatible: true,
      fiqlCompatible: true,
      allowEmptyValues: false,
      allowSlashedArrays: true,
      specialTerms: Object.keys(specialTerms)
    });
  }

  var query = new Query();
  var cachedSpecialTerms = {};

  query.selector = exports.parser.parse(queryString, cachedSpecialTerms);

  for (var specialTerm in cachedSpecialTerms)
  {
    if (cachedSpecialTerms.hasOwnProperty(specialTerm)
      && specialTerms.hasOwnProperty(specialTerm))
    {
      specialTerms[specialTerm](
        query, specialTerm, cachedSpecialTerms[specialTerm]
      );
    }
  }

  return query;
};

});
