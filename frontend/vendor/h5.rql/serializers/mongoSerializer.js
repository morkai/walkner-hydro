define(function (require, exports, module) {'use strict';

exports.fromQuery = serializeRqlToMongo;

/**
 * @name h5.rql.serializers.mongoSerializer
 * @param {h5.rql.Query} query
 * @param {(h5.rql.serializers.mongoSerializer.Options|object)=} options
 * @returns {object}
 */
function serializeRqlToMongo(query, options)
{
  if (!(options instanceof serializeRqlToMongo.Options))
  {
    options = new serializeRqlToMongo.Options(options);
  }

  var mongoQuery = {
    selector: convertTerm(options, query.selector) || {},
    fields: query.fields,
    sort: query.sort,
    limit: query.limit < 1 ? 0 : query.limit,
    skip: query.skip
  };

  if (options.compactAnd
    && Array.isArray(mongoQuery.selector.$and)
    && Object.keys(mongoQuery.selector).length === 1)
  {
    mongoQuery.selector = compactQueries(mongoQuery.selector.$and);
  }

  return mongoQuery;
}

/**
 * @constructor
 * @param {object=} options
 */
serializeRqlToMongo.Options = function(options)
{
  if (typeof options !== 'object' || options === null)
  {
    options = {};
  }

  /**
   * @type {boolean}
   */
  this.compactAnd = !options.hasOwnProperty('compactAnd')
    || options.compactAnd === true;

  /**
   * @type {boolean}
   */
  this.allowWhere = options.allowWhere === true;

  /**
   * @type {function}
   */
  this.isPropertyAllowed = typeof options.isPropertyAllowed === 'function'
    ? options.isPropertyAllowed
    : this.createPropertyFilter(options);
};

/**
 * @private
 * @param {object} options
 * @returns {function}
 */
serializeRqlToMongo.Options.prototype.createPropertyFilter = function(options)
{
  if (Array.isArray(options.whitelist))
  {
    var whitelist = options.whitelist;

    return function(property)
    {
      return whitelist.indexOf(property) !== -1;
    };
  }

  if (Array.isArray(options.blacklist))
  {
    var blacklist = options.blacklist;

    return function(property)
    {
      return blacklist.indexOf(property) === -1;
    };
  }

  return function() { return true; };
};

/**
 * @param {h5.rql.serializers.mongoSerializer.Options} options
 * @param {*} term
 * @returns {object}
 */
function convertTerm(options, term)
{
  /*jshint -W015*/

  if (typeof term !== 'object'
    || term === null
    || typeof term.name !== 'string'
    || !Array.isArray(term.args))
  {
    return null;
  }

  switch (term.name)
  {
    case 'and':
    case 'or':
    case 'nor':
      return convertLogicalOperator(options, term.name, term.args);

    case 'not':
      return convertNotOperator(options, term.args);

    case 'eq':
    case 'ne':
    case 'gt':
    case 'ge':
    case 'lt':
    case 'le':
      return convertComparisonOperator(options, term.name, term.args);

    case 'in':
    case 'nin':
    case 'all':
      if (Array.isArray(term.args[1]) && term.args[1].length > 0)
      {
        return convertComparisonOperator(options, term.name, term.args);
      }

      break;

    case 'exists':
      if (typeof term.args[1] === 'boolean')
      {
        return convertBinaryOperator(
          options, 'exists', term.args[0], term.args[1]
        );
      }

      break;

    case 'type':
      if (typeof term.args[1] === 'number')
      {
        return convertBinaryOperator(
          options, 'type', term.args[0], term.args[1]
        );
      }

      break;

    case 'mod':
      return convertModOperator(options, term.args);

    case 'where':
      if (options.allowWhere && typeof term.args[0] === 'string')
      {
        return {$where: term.args[0]};
      }

      break;

    case 'regex':
      return convertRegexOperator(options, term.args);

    case 'size':
      if (typeof term.args[1] === 'number')
      {
        return convertBinaryOperator(
          options, 'size', term.args[0], term.args[1]
        );
      }

      break;

    case 'elemMatch':
      return convertElemMatchOperator(options, term.args);
  }

  return null;
}

/**
 * @param {h5.rql.serializers.mongoSerializer.Options} options
 * @param {string} operator
 * @param {string} property
 * @param {*} value
 * @returns {object}
 */
function convertBinaryOperator(options, operator, property, value)
{
  if (Array.isArray(property))
  {
    property = property.join('.');
  }

  if (!options.isPropertyAllowed(property))
  {
    return null;
  }

  var query = {};
  query[property] = {};
  query[property]['$' + operator] = value;

  return query;
}

/**
 * @param {h5.rql.serializers.mongoSerializer.Options} options
 * @param {Array} args
 * @returns {object|null}
 */
function convertModOperator(options, args)
{
  if (Array.isArray(args[1])
    && args[1].length === 2
    && typeof args[1][0] === 'number'
    && typeof args[1][1] === 'number')
  {
    return convertBinaryOperator(options, 'mod', args[0], args[1]);
  }

  if (args.length >= 3
    && typeof args[1] === 'number'
    && typeof args[2] === 'number')
  {
    return convertBinaryOperator(options, 'mod', args[0], [args[1], args[2]]);
  }

  return null;
}

/**
 * @param {h5.rql.serializers.mongoSerializer.Options} options
 * @param {Array} args
 * @returns {object|null}
 */
function convertRegexOperator(options, args)
{
  if (args.length >= 2
    && (typeof args[1] === 'string' || args[1] instanceof RegExp))
  {
    var property = Array.isArray(args[0]) ? args[0].join('.') : args[0];

    if (!options.isPropertyAllowed(property))
    {
      return null;
    }

    var query = convertBinaryOperator(options, 'regex', property, args[1]);

    if (args.length >= 3 && typeof args[2] === 'string')
    {
      query[property].$options = args[2];
    }

    return query;
  }

  return null;
}

/**
 * @param {h5.rql.serializers.mongoSerializer.Options} options
 * @param {Array} args
 * @returns {object|null}
 */
function convertElemMatchOperator(options, args)
{
  if (args.length < 2)
  {
    return null;
  }

  var property = Array.isArray(args[0]) ? args[0].join('.') : args[0];

  if (!options.isPropertyAllowed(property))
  {
    return null;
  }

  args = [].concat(args);
  args.shift();

  var query = convertLogicalOperator(options, 'and', args);

  if (query === null)
  {
    return null;
  }

  var elemMatch = compactQueries(query.$and);

  return convertBinaryOperator(options, 'elemMatch', property, elemMatch);
}

/**
 * @param {h5.rql.serializers.mongoSerializer.Options} options
 * @param {string} operator
 * @param {Array} args
 * @returns {object|null}
 */
function convertLogicalOperator(options, operator, args)
{
  var queries = [];

  for (var i = 0, l = args.length; i < l; ++i)
  {
    var nested = convertTerm(options, args[i]);

    if (nested !== null)
    {
      queries.push(nested);
    }
  }

  if (queries.length === 0)
  {
    return null;
  }

  var query = {};
  query['$' + operator] = queries;

  return query;
}

/**
 * @param {h5.rql.serializers.mongoSerializer.Options} options
 * @param {Array} args
 * @returns {object|null}
 */
function convertNotOperator(options, args)
{
  /*jshint loopfunc:true*/

  var query = {};
  var count = 0;

  for (var i = 0, l = args.length; i < l; ++i)
  {
    var nested = convertTerm(options, args[i]);

    if (nested === null)
    {
      continue;
    }

    Object.keys(nested).forEach(function(property)
    {
      if (property[0] === '$')
      {
        return;
      }

      count += 1;

      if (!query.hasOwnProperty(property))
      {
        query[property] = {};
      }

      var nestedValue = nested[property];

      if (!isOperatorObject(nestedValue, false))
      {
        query[property].$ne = nestedValue;

        return;
      }

      if (!query[property].hasOwnProperty('$not'))
      {
        query[property].$not = {};
      }

      Object.keys(nestedValue).forEach(function(nestedProperty)
      {
        if (nestedProperty[0] === '$')
        {
          query[property].$not[nestedProperty] = nestedValue[nestedProperty];
        }
      });
    });
  }

  return count === 0 ? null : query;
}

/**
 * @param {h5.rql.serializers.mongoSerializer.Options} options
 * @param {string} operator
 * @param {Array} args
 * @returns {object|null}
 */
function convertComparisonOperator(options, operator, args)
{
  if (args.length < 2)
  {
    return null;
  }

  var property = Array.isArray(args[0]) ? args[0].join('.') : args[0];

  if (!options.isPropertyAllowed(property))
  {
    return null;
  }

  var value = args[1];
  var query = {};

  if (operator === 'eq')
  {
    query[property] = value;

    return query;
  }

  if (operator === 'le')
  {
    operator = 'lte';
  }
  else if (operator === 'ge')
  {
    operator = 'gte';
  }

  query[property] = {};
  query[property]['$' + operator] = value;

  return query;
}

/**
 * @param {Array.<object>} queries
 * @returns {object}
 */
function compactQueries(queries)
{
  var selector = {};

  for (var i = 0, l = queries.length; i < l; ++i)
  {
    compactQuery(selector, queries[i]);
  }

  return selector;
}

/**
 * @param {object} selector
 * @param {object} query
 */
function compactQuery(selector, query)
{
  Object.keys(query).forEach(function(property)
  {
    if (typeof selector[property] === 'undefined')
    {
      selector[property] = {};
    }

    compactQueryValue(selector, property, query[property]);
  });
}

/**
 * @param {object} selector
 * @param {string} property
 * @param {*} value
 */
function compactQueryValue(selector, property, value)
{
  // Change the value only if the current operator is not eq
  if (isOperatorObject(selector[property], true))
  {
    // Merge operators if the value is not an eq operator
    if (isOperatorObject(value, false))
    {
      for (var op in value)
      {
        if (value.hasOwnProperty(op))
        {
          selector[property][op] = value[op];
        }
      }
    }
    // Otherwise, overwrite the previous operators with an eq operator
    else
    {
      selector[property] = value;
    }
  }
}

/**
 * @param {object} obj
 * @param {boolean} empty What to return if the specified object is empty.
 * @returns {boolean}
 */
function isOperatorObject(obj, empty)
{
  if (typeof obj !== 'object' || obj === null)
  {
    return false;
  }

  var properties = Object.keys(obj);

  if (properties.length === 0)
  {
    return empty;
  }

  for (var i = 0, l = properties.length; i < l; ++i)
  {
    if (properties[i][0] === '$')
    {
      return true;
    }
  }

  return false;
}

});
