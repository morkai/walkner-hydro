// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'h5.rql/index',
  './util'
], function(
  rql,
  util
) {
  'use strict';

  var urlPartsRegExp = /^\/(.*?)(?:\?(.*?))?(?:#(.*?))?$/;

  function Request(url)
  {
    if (url[0] !== '/')
    {
      url = '/' + url;
    }

    var urlParts = url.match(urlPartsRegExp);

    /**
     * @type {string}
     */
    this.url = url;

    /**
     * @type {string}
     */
    this.path = (urlParts[1][0] === '/' ? '' : '/') + urlParts[1];

    /**
     * @type {string}
     */
    this.queryString = urlParts[2] || '';

    /**
     * @type {string}
     */
    this.fragment = urlParts[3] || '';

    /**
     * @type {object}
     */
    this.params = {};

    /**
     * @type {object.<string, string>}
     */
    this.query = {};

    /**
     * @type {object}
     */
    this.rql = {};

    if (this.queryString !== '')
    {
      this.defineGetters();
    }
  }

  Request.prototype.defineGetters = function()
  {
    Object.defineProperty(this, 'query', {
      enumerable: true,
      configurable: true,
      get: function()
      {
        return this.parseQueryString();
      },
      set: function(value)
      {
        this.query = value;
      }
    });

    Object.defineProperty(this, 'rql', {
      enumerable: true,
      configurable: true,
      get: function()
      {
        return this.parseRqlString();
      },
      set: function(value)
      {
        this.rql = value;
      }
    });
  };

  Request.prototype.parseQueryString = function()
  {
    delete this.query;

    var queryParts = this.queryString.split('&');
    var query = {};

    for (var i = 0, l = queryParts.length; i < l; ++i)
    {
      var queryPart = queryParts[i];
      var eqPos = queryPart.indexOf('=');

      if (eqPos === -1)
      {
        continue;
      }

      var name = util.decodeUriComponent(queryPart.substr(0, eqPos));
      var value = util.decodeUriComponent(queryPart.substr(eqPos + 1));

      query[name] = value;
    }

    this.query = query;

    return query;
  };

  Request.prototype.parseRqlString = function()
  {
    delete this.rql;

    this.rql = rql.parse(this.queryString);

    return this.rql;
  };

  return Request;
});
