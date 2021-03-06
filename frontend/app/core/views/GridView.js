// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  '../View',
  'app/core/templates/grid'
], function(
  View,
  gridTemplate
) {
  'use strict';

  /**
   * @name app.core.views.GridView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var GridView = View.extend({

    template: gridTemplate

  });

  GridView.prototype.serialize = function()
  {
    var rows = this.options.rows
      ? this.options.rows
      : [{columns: this.options.columns}];

    return {
      rowClassName: this.options.fluid === false ? 'row' : 'row-fluid',
      rows: rows.map(function(row)
      {
        row.className = row.className || '';
        row.columns = (row.columns || []).map(function(column)
        {
          column.id = column.id || '';
          column.span = column.span || 12;
          column.className = column.className || '';

          return column;
        });

        return row;
      })
    };
  };

  return GridView;
});
