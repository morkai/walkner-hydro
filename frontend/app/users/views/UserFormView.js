// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'jquery',
  'form2js',
  'js2form',
  'app/i18n',
  'app/viewport',
  'app/core/View',
  'app/users/templates/form',
  'i18n!app/nls/users'
], function(
  _,
  $,
  form2js,
  js2form,
  t,
  viewport,
  View,
  formTemplate
) {
  'use strict';

  /**
   * @name app.users.views.UserFormView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var UserFormView = View.extend({

    template: formTemplate,

    events: {
      'submit': 'submitForm',
      'input input[type="password"]': function(e)
      {
        if (this.timers.validatePasswords !== null)
        {
          clearTimeout(this.timers.validatePasswords);
        }

        this.timers.validatePasswords =
          setTimeout(this.validatePasswords.bind(this, e), 100);
      }
    }

  });

  UserFormView.prototype.initialize = function()
  {
    this.$errorMessage = null;

    this.listenTo(this.model, 'change', function(user)
    {
      js2form(this.el, user.toJSON());
    });

    this.render();
  };

  UserFormView.prototype.destroy = function()
  {
    this.$errorMessage = null;
  };

  UserFormView.prototype.afterRender = function()
  {
    if (this.options.requirePassword)
    {
      this.$('input[type="password"]').attr('required', true);
    }
  };

  UserFormView.prototype.serialize = function()
  {
    return {
      formMethod: this.options.formMethod,
      formAction: this.options.formAction,
      formActionText: this.options.formActionText,
      user: this.model.toJSON()
    };
  };

  /**
   * @private
   */
  UserFormView.prototype.validatePasswords = function()
  {
    var password1 = this.el.querySelector('#user-password');
    var password2 = this.el.querySelector('#user-password2');

    if (password1.value === password2.value)
    {
      password2.setCustomValidity('');
    }
    else
    {
      password2.setCustomValidity(t('users', 'FORM_ERROR_PASSWORD_MISMATCH'));
    }
  };

  /**
   * @private
   * @param {jQuery.Event} e
   * @returns {boolean}
   */
  UserFormView.prototype.submitForm = function(e)
  {
    e.preventDefault();

    if (this.$errorMessage !== null)
    {
      viewport.msg.hide(this.$errorMessage);

      this.$errorMessage = null;
    }

    if (!this.el.checkValidity())
    {
      return false;
    }

    var $submitEl = this.$('[type="submit"]').attr('disabled', true);

    var data = _.defaults(form2js(this.el), {privileges: []});

    var req = $.ajax({
      type: this.options.formMethod,
      url: this.el.action,
      data: JSON.stringify(data),
      contentType: 'application/json'
    });

    var broker = this.broker;

    req.done(function(res)
    {
      broker.publish('router.navigate', {
        url: '/users/' + res._id,
        trigger: true
      });
    });

    var userFormView = this;

    req.fail(function()
    {
      userFormView.$errorMessage = viewport.msg.show({
        type: 'error',
        text: userFormView.options.failureText
      });
    });

    req.always(function()
    {
      $submitEl.attr('disabled', false);
    });

    return false;
  };

  return UserFormView;
});
