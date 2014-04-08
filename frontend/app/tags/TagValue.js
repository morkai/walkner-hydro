// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
