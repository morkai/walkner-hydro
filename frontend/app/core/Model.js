define([
  'backbone'
], function(
  Backbone
) {
  'use strict';

  /**
   * @name app.core.Model
   * @constructor
   * @extends {Backbone.Model}
   * @param {object} [attributes]
   */
  var Model = Backbone.Model.extend({

    idAttribute: '_id'

  });

  /**
   * @param {string} [action]
   * @returns {string}
   */
  Model.prototype.genUrl = function(action)
  {
    var url = Backbone.Model.prototype.url.call(this);

    if (typeof action === 'string')
    {
      url += ';' + action;
    }

    if (url[0] === '/')
    {
      url = url.substr(1);
    }

    return '#' + url;
  };

  return Model;
});
