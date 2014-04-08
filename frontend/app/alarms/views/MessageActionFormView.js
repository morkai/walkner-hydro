// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'jquery',
  'app/i18n',
  'app/users/UsersCollection',
  'app/core/View',
  'app/alarms/templates/messageActionForm',
  'i18n!app/nls/alarms'
], function(
  _,
  $,
  t,
  UsersCollection,
  View,
  messageActionFormTemplate
) {
  'use strict';

  /**
   * @name app.alarms.views.MessageActionFormView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var MessageActionFormView = View.extend({

    template: messageActionFormTemplate,

    events: {
      'typeahead:selected .alarms-form-action-users-input': 'onUserSelect'
    }

  });

  MessageActionFormView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('alarms-form-action-message');

    /**
     * @private
     * @type {string}
     */
    this.fieldNamePrefix =
      (this.options.kind || 'start') + 'Actions[' + this.options.index + ']';

    /**
     * @private
     * @type {number}
     */
    this.userIndex = 0;

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$usersInput = null;
  };

  MessageActionFormView.prototype.destroy = function()
  {
    if (this.$usersInput !== null)
    {
      this.$usersInput.typeahead('destroy');
      this.$usersInput = null;
    }
  };

  MessageActionFormView.prototype.afterRender = function()
  {
    var extraUserProperty = this.options.extraUserProperty || '_id';

    this.$usersInput = this.$('.alarms-form-action-users-input');

    this.$usersInput.typeahead({
      name: 'users-' + this.options.actionType,
      valueKey: 'login',
      limit: 5,
      template: function(context)
      {
        return '<p>' + context.login + ' (' + context[extraUserProperty]
          + ')</p>';
      },
      remote: {
        url: '/users' +
          '?select(login,' + extraUserProperty + ')' +
          '&sort(+login)' +
          '&limit(10)' +
          '&regex(login,%QUERY)',
        filter: function(res)
        {
          return res && res.collection ? res.collection : [];
        }
      }
    });

    this.$usersInput.prev('.tt-hint').addClass('span6');

    var action = this.model.action;
    var users = this.model.users;

    if (action && action.parameters && users)
    {
      var addUser = this.addUser.bind(this);

      action.parameters.users.forEach(function(userId)
      {
        var user = users.get(userId);

        if (user)
        {
          addUser(user.toJSON());
        }
      });
    }
  };

  MessageActionFormView.prototype.serialize = function()
  {
    return {
      actionType: this.options.actionType,
      idPrefix: this.idPrefix,
      fieldNamePrefix: this.fieldNamePrefix
    };
  };

  /**
   * @private
   * @param {jQuery.Event} e
   * @param {object} user
   */
  MessageActionFormView.prototype.onUserSelect = function(e, user)
  {
    this.$usersInput.val('');
    this.addUser(user);
  };

  /**
   * @private
   * @param {object} user
   */
  MessageActionFormView.prototype.addUser = function(user)
  {
    if (this.$('input[value="' + user._id + '"]').length !== 0)
    {
      return;
    }

    var $li = $('<li></li>');
    var $label = $('<label class="checkbox"></label>');
    var $input = $('<input type="checkbox" checked>');

    $input.attr(
      'name',
      this.fieldNamePrefix + '.parameters.users[' + this.userIndex + ']'
    );
    $input.attr('value', user._id);

    $label.append($input);
    $label.append(user.login);
    $li.append($label);

    this.$('.alarms-form-action-users-list').append($li);

    ++this.userIndex;

    this.trigger('resize');
  };

  return MessageActionFormView;
});
