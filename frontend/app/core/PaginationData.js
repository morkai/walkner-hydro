// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'backbone'
], function(
  _,
  Backbone
) {
  'use strict';

  /**
   * @name app.core.PaginationData
   * @constructor
   * @extends {Backbone.Model}
   * @param {object} attributes
   * @param {number} [attributes.totalCount]
   * @param {string} [attributes.urlTemplate]
   * @param {number} [attributes.page]
   * @param {number} [attributes.skip]
   * @param {number} [attributes.limit]
   */
  var PaginationData = Backbone.Model.extend({

    defaults: {
      totalCount: -1,
      urlTemplate: '?page=${page}&limit=${limit}',
      page: 1,
      skip: 0,
      limit: 10
    }

  });

  PaginationData.prototype.initialize = function()
  {
    this.on('change', this.recalcAttrs, this);

    var attrs = this.attributes;

    if (attrs.page < 1)
    {
      attrs.page = 1;
    }

    if (attrs.skip < 0)
    {
      attrs.skip = 0;
    }

    if (attrs.limit < 1)
    {
      attrs.limit = 1;
    }

    if (attrs.skip !== 0)
    {
      this.recalcPage();
    }
    else if (attrs.page !== 1)
    {
      this.recalcSkip();
    }
    else
    {
      this.adjustSkipToLimit();
    }
  };

  /**
   * @throws {Error}
   */
  PaginationData.prototype.sync = function()
  {
    throw new Error("Not supported!");
  };

  /**
   * @private
   */
  PaginationData.prototype.recalcAttrs = function()
  {
    var attrs = this.changedAttributes();

    if (_.has(attrs, 'total') || _.has(attrs, 'skip') || _.has(attrs, 'limit'))
    {
      this.recalcPage();
    }
    else if (_.has(attrs, 'page'))
    {
      this.recalcSkip();
    }
  };

  /**
   * @private
   */
  PaginationData.prototype.recalcPage = function()
  {
    this.adjustSkipToLimit();

    var attrs = this.attributes;

    attrs.page = (attrs.skip / attrs.limit) + 1;
  };

  /**
   * @private
   */
  PaginationData.prototype.recalcSkip = function()
  {
    var attrs = this.attributes;

    attrs.skip = (attrs.page - 1) * attrs.limit;
  };

  /**
   * @private
   */
  PaginationData.prototype.adjustSkipToLimit = function()
  {
    var attrs = this.attributes;

    if (attrs.skip >= attrs.total)
    {
      attrs.skip = attrs.total < 2 ? 1 : attrs.total - 1;
    }

    var r = attrs.skip % attrs.limit;

    if (r !== 0)
    {
      attrs.skip -= r;
    }
  };

  return PaginationData;
});
