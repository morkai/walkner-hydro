// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/core/Collection',
  './TagValue'
], function(
  Collection,
  TagValue
) {
  'use strict';

  /**
   * @name app.tags.TagsCollection
   * @constructor
   * @extends {app.core.Collection}
   * @param {Array.<object>} [models]
   * @param {object} [options]
   */
  var TagValuesCollection = Collection.extend({

    url: function()
    {
      return '/tags/' + this.tag + '/changes';
    },

    clientUrl: function()
    {
      return '#analytics/changes/' + this.tag;
    },

    model: TagValue,

    rqlQuery: 'limit(25)'

  });

  TagValuesCollection.prototype.initialize = function(models, options)
  {
    this.tag = options.tag;
  };

  return TagValuesCollection;
});
