define([
  'app/viewport',
  'app/i18n',
  'app/core/View',
  'app/users/templates/details',
  'i18n!app/nls/users'
], function(
  viewport,
  t,
  View,
  detailsTemplate
) {
  'use strict';

  /**
   * @name app.users.views.UserDetailsView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var UserDetailsView = View.extend({

    template: detailsTemplate,

    remoteTopics: {
      'users.edited': function(message)
      {
        var updatedUser = message.model;

        if (updatedUser._id === this.model.id)
        {
          this.model.set(updatedUser);
        }
      },
      'users.deleted': function(message)
      {
        var deletedUser = message.model;

        if (deletedUser._id === this.model.id)
        {
          this.broker
            .subscribe('router.executing')
            .setLimit(1)
            .on('message', function()
            {
              viewport.msg.show({
                type: 'warning',
                time: 5000,
                text: t('users', 'MESSAGE_USER_DELETED', {
                  login: deletedUser.login
                })
              });
            });

          this.broker.publish('router.navigate', {
            url: '/users',
            trigger: true
          });
        }
      }
    }

  });

  UserDetailsView.prototype.initialize = function()
  {
    this.listenTo(this.model, 'change', this.render);
  };

  UserDetailsView.prototype.serialize = function()
  {
    return {
      user: this.model.toJSON()
    };
  };

  return UserDetailsView;
});
