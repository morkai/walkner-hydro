// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'underscore',
  './util',
  './Request'
], function(
  _,
  util,
  Request
) {
  'use strict';

  var pathParamRegExp = /([:*])([\w\-]+)?/g;

  var escapeRegExp = /[\-\[\]{}()+?.,\\\^$|#\s]/g;

  function Router(broker)
  {
    /**
     * @private
     * @type {h5.pubsub.Broker}
     */
    this.broker = broker;

    /**
     * @private
     * @type {Array}
     */
    this.routes = [];

    /**
     * @private
     * @type {Boolean}
     */
    this.dispatching = false;

    /**
     * @private
     * @type {Array.<string>}
     */
    this.dispatchQueue = [];

    /**
     * @private
     * @type {Request|null}
     */
    this.currentRequest = null;

    /**
     * @private
     * @type {string|null}
     */
    this.previousUrl = null;
  }

  /**
   * @returns {Request|null}
   */
  Router.prototype.getCurrentRequest = function()
  {
    return this.currentRequest;
  };

  /**
   * @param {string} url
   */
  Router.prototype.setCurrentRequest = function(url)
  {
    this.currentRequest = new Request(url);
  };

  /**
   * @param {string|RegExp} pattern
   * @param {...function(app.core.Request, string)} handlers
   */
  Router.prototype.map = function(pattern)
  {
    var handlers = Array.prototype.slice.call(arguments);

    handlers.shift();

    this.routes.unshift(this.createMatcher(pattern), handlers);
  };

  /**
   * @param {string} url
   * @param {object} [options]
   * @param {Boolean=false} options.trigger
   * @param {Boolean=false} options.replace
   */
  Router.prototype.navigate = function(url, options)
  {
    this.broker.publish('router.navigate', _.extend({url: url}, options));
  };

  /**
   * @param {string} url
   */
  Router.prototype.replace = function(url)
  {
    this.broker.publish('router.navigate', {
      url: url,
      trigger: true,
      replace: true
    });
  };

  /**
   * @param {string} url
   */
  Router.prototype.update = function(url)
  {
    this.broker.publish('router.navigate', {
      url: url,
      trigger: false,
      replace: true
    });
  };

  /**
   * @param {string} url
   */
  Router.prototype.dispatch = function(url)
  {
    if (_.isUndefined(url))
    {
      return;
    }

    if (url === null)
    {
      url = '/';
    }

    if (this.dispatching)
    {
      this.dispatchQueue.push(url);

      return;
    }

    this.dispatching = true;

    var req = new Request(url);

    this.broker.publish('router.dispatching', req);

    var matchedHandlers = this.match(req);

    if (matchedHandlers === null)
    {
      this.dispatching = false;

      var nextUrl = this.dispatchQueue.shift();

      if (_.isUndefined(nextUrl))
      {
        this.broker.publish('router.404', req);
      }
      else
      {
        this.dispatch(nextUrl);
      }
    }
    else
    {
      this.broker.publish('router.matched', {
        handlers: matchedHandlers,
        req: req
      });

      _.defer(this.execute.bind(this, matchedHandlers, req));
    }
  };

  /**
   * @private
   * @param {app.core.Request} req
   * @returns {function|null}
   */
  Router.prototype.match = function(req)
  {
    var routes = this.routes;

    for (var i = 0, l = routes.length; i < l; i += 2)
    {
      var routeMatcher = routes[i];

      if (routeMatcher(req))
      {
        return routes[i + 1];
      }
    }

    return null;
  };

  /**
   * @private
   * @param {Array.<function>} handlers
   * @param {app.core.Request} req
   */
  Router.prototype.execute = function(handlers, req)
  {
    this.currentRequest = req;

    this.broker.publish('router.executing', {
      handlers: handlers,
      req: req
    });

    var previousUrl = this.previousUrl;

    function executeNext(i)
    {
      if (i + 1 < handlers.length)
      {
        handlers[i](req, previousUrl, executeNext.bind(null, i + 1));
      }
      else
      {
        handlers[i](req, previousUrl);
      }
    }

    executeNext(0);

    this.previousUrl = req.url;
    this.dispatching = false;

    this.dispatch(this.dispatchQueue.shift());
  };

  /**
   * @private
   * @param {string|RegExp} pattern
   * @returns {function(app.core.Request): boolean}
   */
  Router.prototype.createMatcher = function(pattern)
  {
    if (pattern instanceof RegExp)
    {
      return createRegExpMatcher(pattern);
    }

    pattern = pattern.trim();

    if (pattern === '' || pattern === '/')
    {
      return function matchEmptyPath(req)
      {
        return req.path === '' || req.path === '/';
      };
    }

    var params = [];
    var isRegExp = false;
    var patternRegExp = pattern.replace(escapeRegExp, '\\$&');

    patternRegExp =
      patternRegExp.replace(pathParamRegExp, function(match, op, param)
    {
      isRegExp = true;

      if (_.isUndefined(param))
      {
        return op === '*' ? '.*' : match;
      }

      params.push(param);

      return op === '*' ? '(.*?)' : '([^/#?;]*)';
    });

    if (!isRegExp)
    {
      return function matchStaticPath(req)
      {
        return req.path === pattern;
      };
    }

    return createRegExpMatcher(new RegExp('^' + patternRegExp + '$'), params);
  };

  /**
   * @param {RegExp} regExp
   * @param {Array.<string>} [params]
   * @returns {function(app.core.Request): boolean}
   */
  function createRegExpMatcher(regExp, params)
  {
    return function matchRegExpPath(req)
    {
      var matches = regExp.exec(req.path);

      if (matches === null)
      {
        return false;
      }

      var matchCount = matches.length;

      if (matchCount === 1)
      {
        return true;
      }

      var paramCount = _.isArray(params) ? params.length : 0;
      var i;

      if (matchCount === paramCount + 1)
      {
        for (i = 0; i < paramCount; ++i)
        {
          req.params[params[i]] = util.decodeUriComponent(matches[i + 1]);
        }
      }
      else
      {
        for (i = 0; i < matchCount; ++i)
        {
          req.params[i] = util.decodeUriComponent(matches[i]);
        }
      }

      return true;
    };
  }

  return Router;
});
