// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'app/core/View',
  'app/alarms/templates/severityActionForm',
  'i18n!app/nls/alarms'
], function(
  _,
  View,
  severityActionFormTemplate
) {
  'use strict';

  /**
   * @name app.alarms.views.SeverityActionFormView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var SeverityActionFormView = View.extend({

    template: severityActionFormTemplate

  });

  SeverityActionFormView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('alarms-form-action-severity');

    /**
     * @private
     * @type {string}
     */
    this.fieldNamePrefix =
      (this.options.kind || 'start') + 'Actions[' + this.options.index + ']';
  };

  SeverityActionFormView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      fieldNamePrefix: this.fieldNamePrefix
    };
  };

  return SeverityActionFormView;
});
