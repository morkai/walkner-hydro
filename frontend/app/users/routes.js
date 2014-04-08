// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/router',
  'app/user',
  './pages/UsersListPage',
  './pages/UserDetailsPage',
  './pages/AddUserFormPage',
  './pages/EditUserFormPage',
  './pages/UserActionFormPage',
  'i18n!app/nls/users'
], function(
  router,
  user,
  UsersListPage,
  UserDetailsPage,
  AddUserFormPage,
  EditUserFormPage,
  UserActionFormPage
) {
  'use strict';

  var canView = user.auth('USERS_VIEW');
  var canManage = user.auth('USERS_MANAGE');

  router.map('/users', canView, function showUsersListPage(req)
  {
    var page = new UsersListPage({
      rql: req.rql
    });

    page.render();
  });

  router.map(
    '/users/:id',
    function(req, referer, next)
    {
      if (req.params.id === user._id)
      {
        next();
      }
      else
      {
        canView(req, referer, next);
      }
    },
    function showUserDetailsPage(req)
    {
      var page = new UserDetailsPage({
        userId: req.params.id
      });

      page.render();
    }
  );

  router.map('/users;add', canManage, function showAddUserFormPage()
  {
    var page = new AddUserFormPage();

    page.render();
  });

  router.map('/users/:id;edit', canManage, function showEditUserFormPage(req)
  {
    var page = new EditUserFormPage({
      userId: req.params.id
    });

    page.render();
  });

  router.map(
    '/users/:id;delete',
    canManage,
    function showDeleteUserFormPage(req, referer)
    {
      var page = new UserActionFormPage({
        userId: req.params.id,
        actionKey: 'delete',
        successUrl: '#users',
        cancelUrl: '#' + (referer || '/users').substr(1),
        formMethod: 'DELETE',
        formAction: '/users/' + req.params.id,
        formActionSeverity: 'danger'
      });

      page.render();
    }
  );
});
