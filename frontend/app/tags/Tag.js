define([
  'app/core/Model'
], function(
  Model
) {
  'use strict';

  /**
   * @name app.tags.Tag
   * @constructor
   * @extends {app.core.Model}
   * @param {object} [attributes]
   */
  var Tag = Model.extend({

    idAttribute: 'name',

    urlRoot: '/tags',

    defaults: {
      description: '',
      master: null,
      unit: -1,
      kind: 'virtual',
      type: 'uint16',
      address: null,
      readable: false,
      writable: false,
      rawMin: null,
      rawMax: null,
      scaleUnit: null,
      scaleFunction: null,
      scaleMin: null,
      scaleMax: null,
      archive: null
    }

  });

  return Tag;
});
