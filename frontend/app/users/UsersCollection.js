define([
  'app/core/Collection',
  './User'
], function(
  Collection,
  User
) {
  'use strict';

  /**
   * @name app.users.UsersCollection
   * @constructor
   * @extends {app.core.Collection}
   * @param {Array.<object>} [models]
   * @param {object} [options]
   */
  var UsersCollection = Collection.extend({

    url: '/users',

    clientUrl: '#users',

    model: User,

    rqlQuery: 'select(login,email,mobile)&sort(+name)&limit(10)'

  });

  return UsersCollection;
});
