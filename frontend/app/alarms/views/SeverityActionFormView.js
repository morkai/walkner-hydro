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
