// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/viewport',
  'app/i18n',
  '../Page',
  '../View',
  'app/core/templates/error400',
  'app/core/templates/error401',
  'app/core/templates/error404',
  'i18n!app/nls/core'
], function(
  viewport,
  t,
  Page,
  View,
  error400Template,
  error401Template,
  error404Template
) {
  'use strict';

  /**
   * @name app.core.ErrorPage
   * @constructor
   * @extends {app.core.Page}
   * @param {object} [options]
   * @param {h5.rql.Query} [options.rql]
   */
  var ErrorPage = Page.extend({

    breadcrumbs: function()
    {
      return [
        t.bound('core', 'BREADCRUMBS_ERROR', {
          code: this.options.code,
          codeStr: 'e' + this.options.code
        })
      ];
    }

  });

  ErrorPage.prototype.initialize = function()
  {
    this.defineViews();
  };

  ErrorPage.prototype.render = function()
  {
    viewport
      .useLayout('page')
      .setId('errors-' + this.options.code)
      .setBreadcrumbs(this.breadcrumbs)
      .setView('.bd', this.errorView)
      .render();
  };

  /**
   * @private
   */
  ErrorPage.prototype.defineViews = function()
  {
    /*jshint -W015*/

    var template;

    switch (this.options.code)
    {
      case 401:
        template = error401Template;
        break;

      case 404:
        template = error404Template;
        break;

      default:
        template = error400Template;
        break;
    }

    this.errorView = new View({template: template});
  };

  return ErrorPage;
});
