define([
  'app/core/Model'
], function(
  Model
) {
  'use strict';

  /**
   * @name app.tags.TagValue
   * @constructor
   * @extends {app.core.Model}
   * @param {object} [attributes]
   */
  var TagValue = Model.extend({

    defaults: {
      t: -1,
      s: NaN,
      n: NaN,
      x: NaN,
      v: NaN
    }

  });

  return TagValue;
});
