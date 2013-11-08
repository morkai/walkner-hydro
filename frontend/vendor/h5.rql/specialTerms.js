define(function (require, exports, module) {'use strict';

module.exports = {
  select: selectTermHandler,
  exclude: selectTermHandler,
  sort: sortTermHandler,
  limit: limitTermHandler
};

/**
 * @param {h5.rql.Query} query
 * @param {string} name
 * @param {Array} args
 */
function selectTermHandler(query, name, args)
{
  query.fields = {};

  var value = name === 'select';

  for (var i = 0, l = args.length; i < l; ++i)
  {
    var field = args[i];

    if (Array.isArray(field))
    {
      field = field.join('.');
    }

    query.fields[field] = value;
  }
}

/**
 * @param {h5.rql.Query} query
 * @param {string} name
 * @param {Array} args
 */
function sortTermHandler(query, name, args)
{
  query.sort = {};

  for (var i = 0, l = args.length; i < l; ++i)
  {
    var field = args[i];

    if (Array.isArray(field))
    {
      field = field.join('.');
    }

    if (field[0] === '-')
    {
      query.sort[field.substr(1)] = -1;
    }
    else if (field[0] === '+')
    {
      query.sort[field.substr(1)] = 1;
    }
    else
    {
      query.sort[field] = 1;
    }
  }
}

/**
 * @param {h5.rql.Query} query
 * @param {string} name
 * @param {Array} args
 */
function limitTermHandler(query, name, args)
{
  var limit = parseInt(args[0], 10);
  var skip = 0;

  if (args.length > 1)
  {
    skip = parseInt(args[1], 10);
  }

  query.limit = isNaN(limit) || limit < 1 ? -1 : limit;
  query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
}

});
