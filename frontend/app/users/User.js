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
