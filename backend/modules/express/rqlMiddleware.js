'use strict';

var lodash = require('lodash');
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
  if (lodash.isObject(req._parsedUrl) && lodash.isString(req._parsedUrl.query))
  {
    return req._parsedUrl.query;
  }

  if (lodash.isString(req.url))
  {
    var queryPos = req.url.indexOf('?');

    if (queryPos !== -1)
    {
      return req.url.substr(queryPos + 1);
    }
  }

  return '';
}
