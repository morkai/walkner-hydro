// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'backbone',
  'app/core/Collection',
  './Tag'
], function(
  Backbone,
  Collection,
  Tag
) {
  'use strict';

  /**
   * @name app.tags.TagsCollection
   * @constructor
   * @extends {app.core.Collection}
   * @param {Array.<object>} [models]
   * @param {object} [options]
   */
  var TagsCollection = Collection.extend({

    url: '/tags',

    clientUrl: '#tags',

    model: Tag,

    rqlQuery: 'select(name,description,writable,kind)&sort(+name)'

  });

  /**
   * @returns {object.<
   *   string,
   *   {tags: Array.<string>, groups: object.<string, Array.<string>}
   * >}
   */
  TagsCollection.prototype.group = function()
  {
    var result = {other: {tags: [], groups: {}}};
    var tags = this.toJSON();

    tags.sort(function(a, b)
    {
      return a.name > b.name ? 1 : a.name < b.name ? -1 : 0;
    });

    for (var i = 0, l = tags.length; i < l; ++i)
    {
      var currentTag = tags[i];
      var nextTag = tags[i + 1];
      var nameParts = currentTag.name.split('.');
      var group = nameParts[0];
      var subgroup = null;

      if (nameParts.length === 1)
      {
        if (!nextTag || nextTag.name.indexOf(nameParts[0] + '.') !== 0)
        {
          group = 'other';
        }
      }
      else if (/^[0-9]+$/.test(nameParts[1]))
      {
        subgroup = nameParts[1];
      }

      if (!result[group])
      {
        result[group] = {tags: [], groups: {}};
      }

      if (subgroup === null)
      {
        result[group].tags.push(currentTag.name);
      }
      else
      {
        if (!result[group].groups[subgroup])
        {
          result[group].groups[subgroup] = [];
        }

        result[group].groups[subgroup].push(currentTag.name);
      }
    }

    return result;
  };

  return TagsCollection;
});
