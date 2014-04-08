// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
