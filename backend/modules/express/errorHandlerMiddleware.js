// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');

module.exports = function createErrorHandlerMiddleware(expressModule, options)
{
  if (!options)
  {
    options = {};
  }

  // Based on https://github.com/expressjs/errorhandler
  return function errorHandlerMiddleware(err, req, res, next) // eslint-disable-line no-unused-vars
  {
    if (_.includes(expressModule.config.ignoredErrorCodes, err.code))
    {
      return;
    }

    if (err.status)
    {
      res.statusCode = err.status;
    }

    if (res.statusCode < 400)
    {
      res.statusCode = 500;
    }

    if (typeof err === 'string')
    {
      err = {message: err, stack: null};
    }
    else if (err && err.name === 'ValidationError')
    {
      _.forEach(err.errors, function(validationError)
      {
        err.message += '\n  - ' + validationError;
      });
    }

    const login = req.session && req.session.user
      ? req.session.user.login
      : 'guest';

    if (req.method !== 'GET' && req.body !== null && typeof req.body === 'object')
    {
      try
      {
        expressModule.warn(
          '%s %s\n%s\nUser: %s (%s)\nHeaders:\n%s\nRequest body:\n%s',
          req.method,
          req.url,
          err.stack || err.message,
          login,
          req.ip,
          JSON.stringify(req.headers),
          JSON.stringify(req.body)
        );
      }
      catch (err)
      {
        expressModule.warn('%s %s\n%s\nUser: %s (%s)', req.method, req.url, err.stack, login, req.ip);
      }
    }
    else
    {
      expressModule.warn(
        '%s %s\n%s\nUser: %s (%s)\nHeaders:\n%s',
        req.method,
        req.url,
        err.stack || err.message,
        login,
        req.ip,
        JSON.stringify(req.headers)
      );
    }

    if (!res.connection || !res.connection.writable || res.headersSent)
    {
      return;
    }

    const accept = req.headers.accept || '';

    if (accept.indexOf('html') !== -1)
    {
      res.render('error', {
        title: options.title || 'express',
        statusCode: res.statusCode,
        stack: prepareStack(options.basePath, err).reverse(),
        error: err.message.replace(/^Error: /, '')
      });

      return;
    }

    if (accept.indexOf('json') !== -1)
    {
      const error = {
        message: err.message,
        stack: err.stack
      };

      _.forEach(err, function(value, key) { error[key] = value; });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({error: error}));

      return;
    }

    res.setHeader('Content-Type', 'text/plain');
    res.end(err.stack || err.message);
  };
};

function prepareStack(basePath, err)
{
  const stack = (err.stack || '').split('\n').slice(1);

  if (stack.length === 0)
  {
    return [];
  }

  let no = stack.length;

  return stack.map(function(stack)
  {
    let matches = stack.match(/at (.*?) \((.*?):([0-9]+):([0-9]+)\)/);

    if (matches !== null)
    {
      return {
        no: no--,
        func: matches[1],
        path: matches[2],
        file: extractFile(basePath, matches[2]),
        line: matches[3],
        column: matches[4]
      };
    }

    matches = stack.match(/at (.*?):([0-9]+):([0-9]+)/);

    if (matches !== null)
    {
      return {
        no: no--,
        func: '?',
        path: matches[1],
        file: extractFile(basePath, matches[1]),
        line: matches[2],
        column: matches[3]
      };
    }

    return {
      no: no--,
      unknown: stack
    };
  });
}

function extractFile(basePath, path)
{
  if (!basePath || path.toLowerCase().indexOf(basePath.toLowerCase()) !== 0)
  {
    return path;
  }

  return '.' + path.substr(basePath.length);
}
