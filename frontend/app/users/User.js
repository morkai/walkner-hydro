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
   * @name app.users.User
   * @constructor
   * @extends {app.core.Model}
   * @param {object} [attributes]
   */
  var User = Model.extend({

    urlRoot: '/users',

    defaults: {
      login: '',
      email: '',
      mobile: '',
      privileges: null
    }

  });

  User.prototype.initialize = function()
  {
    if (!Array.isArray(this.get('privileges')))
    {
      this.set('privileges', []);
    }
  };

  return User;
});
