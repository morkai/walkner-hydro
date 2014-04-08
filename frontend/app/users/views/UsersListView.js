// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'app/i18n',
  'app/core/View',
  'app/core/views/ActionFormView',
  'app/core/views/PaginationView',
  'app/core/templates/list',
  'i18n!app/nls/users'
], function(
  t,
  View,
  ActionFormView,
  PaginationView,
  listTemplate
) {
  'use strict';

  /**
   * @name app.users.views.UsersListView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var UsersListView = View.extend({

    template: listTemplate,

    remoteTopics: {
      'users.added': 'refreshCollection',
      'users.edited': 'refreshCollection',
      'users.deleted': 'refreshCollection'
    },

    events: {
      'click .action-delete': function(e)
      {
        ActionFormView.showDeleteDialog({
          model: this.getModelFromEvent(e),
          labelProperty: 'login',
          nlsDomain: 'users'
        });

        e.preventDefault();
      }
    }

  });

  UsersListView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {number}
     */
    this.lastRefreshAt = 0;

    this.listenTo(this.model, 'reset', this.render);

    this.setView('.pagination', new PaginationView({
      model: this.model.paginationData
    }));
  };

  UsersListView.prototype.serialize = function()
  {
    var collection = this.model;

    return {
      className: 'users-list',
      columns: [
        {id: 'login', label: t('users', 'PROPERTY_LOGIN')},
        {id: 'email', label: t('users', 'PROPERTY_EMAIL')},
        {id: 'mobile', label: t('users', 'PROPERTY_MOBILE')}
      ],
      actions: function(row)
      {
        return [
          {
            id: 'view-details',
            icon: 'file-alt',
            label: t('core', 'ACTION_VIEW_DETAILS'),
            href: '#users/' + row._id
          },
          {
            id: 'edit',
            icon: 'edit',
            label: t('core', 'ACTION_EDIT'),
            href: '#users/' + row._id + ';edit'
          },
          {
            id: 'delete',
            icon: 'remove',
            label: t('core', 'ACTION_DELETE'),
            href: '#users/' + row._id + ';delete'
          }
        ];
      },
      rows: collection.toJSON().map(function(row)
      {
        row.className = 'users-list-item';
        row.data = {id: row._id};

        return row;
      })
    };
  };

  /**
   * @private
   */
  UsersListView.prototype.refreshCollection = function()
  {
    var now = Date.now();
    var diff = now - this.lastRefreshAt;

    if (now - this.lastRefreshAt < 500)
    {
      this.timers.refreshCollection =
        setTimeout(this.refreshCollection.bind(this), 500 - diff);
    }
    else
    {
      this.lastRefreshAt = Date.now();

      this.model.fetch({reset: true});
    }
  };

  /**
   * @private
   * @param {jQuery.Event} e
   */
  UsersListView.prototype.getModelFromEvent = function(e)
  {
    return this.model.get(
      this.$(e.target).closest('.users-list-item').attr('data-id')
    );
  };

  return UsersListView;
});
