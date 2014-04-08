// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'backbone',
  'h5.rql/index',
  './util',
  './PaginationData'
], function(
  _,
  Backbone,
  rql,
  util,
  PaginationData
) {
  'use strict';

  /**
   * @name app.core.Collection
   * @constructor
   * @extends {Backbone.Collection}
   * @param {Array.<Backbone.Model>} [models]
   * @param {object} [options]
   * @param {object|string} [options.rqlQuery]
   */
  function Collection(models, options)
  {
    if (!_.isObject(options))
    {
      options = {};
    }

    /**
     * @type {h5.rql.Query}
     */
    this.rqlQuery = this.createRqlQuery(options.rqlQuery || this.rqlQuery);

    /**
     * @type {app.models.PaginationData}
     */
    this.paginationData = new PaginationData();

    Backbone.Collection.call(this, models, options);

    this.listenTo(this.paginationData, 'change:page', this.onPageChanged);
  }

  util.inherits(Collection, Backbone.Collection);

  /**
   * @param {object} res
   * @returns {Array.<object>}
   */
  Collection.prototype.parse = function(res)
  {
    this.paginationData.set({
      totalCount: res.totalCount,
      urlTemplate: this.genPaginationUrlTemplate(),
      skip: this.rqlQuery.skip,
      limit: this.rqlQuery.limit
    });

    return res.collection;
  };

  /**
   * @param {string} type
   * @param {Backbone.Model} model
   * @param {object} options
   * @returns {XMLHttpRequest}
   */
  Collection.prototype.sync = function(type, model, options)
  {
    if (type === 'read' && !options.data)
    {
      options.data = this.rqlQuery.toString();
    }

    return Backbone.sync(type, model, options);
  };

  /**
   * @private
   * @param {object|string} rqlQuery
   * @returns {h5.rql.Query}
   */
  Collection.prototype.createRqlQuery = function(rqlQuery)
  {
    if (_.isString(rqlQuery))
    {
      rqlQuery = rql.parse(rqlQuery);
    }
    else if (_.isObject(rqlQuery))
    {
      rqlQuery = rql.Query.fromObject(rqlQuery);
    }

    if (!rqlQuery.isEmpty())
    {
      return rqlQuery;
    }

    if (_.isString(this.rqlQuery))
    {
      return rql.parse(this.rqlQuery);
    }

    if (_.isObject(rqlQuery))
    {
      return rql.Query.fromObject(this.rqlQuery);
    }

    return new rql.Query();
  };

  /**
   * @returns {string}
   */
  Collection.prototype.genPaginationUrlTemplate = function()
  {
    var rqlQuery = this.rqlQuery;
    var skip = rqlQuery.skip;
    var limit = rqlQuery.limit;

    rqlQuery.skip = '${skip}';
    rqlQuery.limit = '${limit}';

    var clientUrl = _.isFunction(this.clientUrl)
      ? this.clientUrl()
      : _.isString(this.clientUrl)
        ? this.clientUrl
        : '#';

    var urlTemplate = clientUrl + '?' + rqlQuery.toString({doubleEncode: true});

    rqlQuery.skip = skip;
    rqlQuery.limit = limit;

    return urlTemplate;
  };

  /**
   * @private
   * @param {app.models.PaginationData} model
   * @param {number} newPage
   */
  Collection.prototype.onPageChanged = function(model, newPage)
  {
    this.rqlQuery.skip = (newPage - 1) * this.rqlQuery.limit;

    this.fetch({reset: true});
  };

  return Collection;
});
