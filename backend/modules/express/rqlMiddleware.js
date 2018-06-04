// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const rql = require('h5.rql');

module.exports = function createRqlMiddleware()
{
  return function rqlMiddleware(req, res, next)
  {
    let rqlQuery = null;

    Object.defineProperty(req, 'rql', {
      configurable: false,
      enumerable: false,
      get: function()
      {
        if (rqlQuery === null)
        {
          try
          {
            rqlQuery = rql.parse(getQueryString(req));
          }
          catch (err)
          {
            rqlQuery = rql.parse('');
          }
        }

        return rqlQuery;
      }
    });

    return next();
  };
};

function getQueryString(req)
{
  if (_.isObject(req._parsedUrl) && _.isString(req._parsedUrl.query))
  {
    return req._parsedUrl.query;
  }

  if (_.isString(req.url))
  {
    const queryPos = req.url.indexOf('?');

    if (queryPos !== -1)
    {
      return req.url.substr(queryPos + 1);
    }
  }

  return '';
}
