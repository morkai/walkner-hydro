// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var _ = require('lodash');
var rql = require('h5.rql');

module.exports = function createRqlMiddleware()
{
  return function rqlMiddleware(req, res, next)
  {
    var rqlQuery = null;

    Object.defineProperty(req, 'rql', {
      configurable: false,
      enumerable: false,
      get: function()
      {
        if (rqlQuery === null)
        {
          rqlQuery = rql.parse(getQueryString(req));
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
    var queryPos = req.url.indexOf('?');

    if (queryPos !== -1)
    {
      return req.url.substr(queryPos + 1);
    }
  }

  return '';
}
