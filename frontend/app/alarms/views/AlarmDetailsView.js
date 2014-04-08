// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'underscore',
  'moment',
  'app/viewport',
  'app/i18n',
  'app/core/View',
  '../Alarm',
  'app/alarms/templates/details',
  'app/alarms/templates/messageActionDetails',
  'app/alarms/templates/severityActionDetails',
  'i18n!app/nls/alarms'
], function(
  _,
  moment,
  viewport,
  t,
  View,
  Alarm,
  detailsTemplate,
  messageActionDetailsTemplate,
  severityActionDetailsTemplate
) {
  'use strict';

  /**
   * @name app.alarms.views.AlarmDetailsView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var AlarmDetailsView = View.extend({

    template: detailsTemplate,

    remoteTopics: {
      'alarms.run': function(message)
      {
        this.updateAlarmModel(message.model, {
          state: Alarm.State.RUNNING,
          severity: null,
          actionIndex: -1
        });
      },
      'alarms.stopped': function(message)
      {
        this.updateAlarmModel(message.model, {
          state: Alarm.State.STOPPED,
          severity: null,
          actionIndex: -1
        });
      },
      'alarms.acked': function(message)
      {
        this.updateAlarmModel(message.model, {
          state: Alarm.State.RUNNING,
          severity: null,
          actionIndex: -1
        });
      },
      'alarms.activated': function(message)
      {
        this.updateAlarmModel(message.model, {state: Alarm.State.ACTIVE});
      },
      'alarms.deactivated': function(message)
      {
        this.updateAlarmModel(message.model, {
          state: Alarm.State.RUNNING,
          severity: null,
          actionIndex: -1
        });
      },
      'alarms.actionExecuted': function(message)
      {
        this.updateAlarmModel(message.model, {
          severity: message.action.severity,
          actionIndex: message.action.no - 1
        });
      },
      'alarms.edited': function(message)
      {
        this.updateAlarmModel(message.model, message.model);
      },
      'alarms.deleted': function(message)
      {
        var alarm = message.model;

        if (alarm._id === this.model.alarm.id)
        {
          this.broker
            .subscribe('router.executing')
            .setLimit(1)
            .on('message', function()
            {
              viewport.msg.show({
                type: 'warning',
                time: 5000,
                text: t('alarms', 'MESSAGE_ALARM_DELETED', {
                  name: alarm.name
                })
              });
            });

          this.broker.publish('router.navigate', {
            url: '/alarms',
            trigger: true
          });
        }
      }
    }

  });

  AlarmDetailsView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {boolean}
     */
    this.rendered = false;
  };

  AlarmDetailsView.prototype.serialize = function()
  {
    var alarm = this.model.alarm.toJSON();

    alarm.state = t('alarms', 'PROPERTY_STATE:' + alarm.state);
    alarm.lastStateChangeTime =
      moment(alarm.lastStateChangeTime).format('YYYY-MM-DD HH:mm:ss');

    return {
      alarm: alarm,
      startActions: this.serializeActions(alarm.startActions)
    };
  };

  AlarmDetailsView.prototype.afterRender = function()
  {
    this.listenToOnce(this.model.alarm, 'change', this.render);

    if (this.model.alarm.get('actionIndex') !== -1)
    {
      this.$('.alarms-details-action')
        .eq(this.model.alarm.get('actionIndex'))
        .addClass('active');
    }
  };

  /**
   * @private
   * @param {Array.<object>} actions
   * @returns {Array.<object>}
   */
  AlarmDetailsView.prototype.serializeActions = function(actions)
  {
    var users = this.model.users;

    return actions.map(function(action)
    {
      /*jshint -W015*/

      switch (action.type)
      {
        case 'sms':
        case 'email':
          if (_.isArray(action.parameters.users))
          {
            action.parameters.users = action.parameters.users
              .map(function(userId)
              {
                var user = users.get(userId);

                if (!user)
                {
                  return;
                }

                return '<a href="#users/' + userId + '">'
                  + user.get('login') + '</a>';
              })
              .filter(function(user) { return !!user; })
              .join(', ');
          }

          action.render = messageActionDetailsTemplate.bind(null, action);

          return action;

        default:
          action.render = severityActionDetailsTemplate.bind(null, action);

          return action;
      }
    })
    .filter(function(action) { return !!action; });
  };

  /**
   * @private
   * @param {object} alarm
   * @param {object} data
   */
  AlarmDetailsView.prototype.updateAlarmModel = function(alarm, data)
  {
    if (alarm._id === this.model.alarm.id)
    {
      this.model.alarm.set(data);
    }
  };

  return AlarmDetailsView;
});
