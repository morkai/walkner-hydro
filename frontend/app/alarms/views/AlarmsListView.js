// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'moment',
  'app/viewport',
  'app/user',
  'app/i18n',
  'app/core/View',
  'app/core/views/ActionFormView',
  'app/core/views/PaginationView',
  'app/core/templates/list',
  '../Alarm',
  'i18n!app/nls/alarms'
], function(
  moment,
  viewport,
  user,
  t,
  View,
  ActionFormView,
  PaginationView,
  listTemplate,
  Alarm
) {
  'use strict';

  /**
   * @name app.alarms.views.AlarmsListView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var AlarmsListView = View.extend({

    template: listTemplate,

    remoteTopics: {
      'alarms.*': 'refreshCollection'
    },

    events: {
      'click .action-alarm-ack': function(e)
      {
        ActionFormView.showDialog({
          actionKey: 'ack',
          model: this.getModelFromEvent(e),
          labelProperty: 'name',
          nlsDomain: 'alarms',
          formActionSeverity: 'success'
        });

        e.preventDefault();
      },
      'click .action-alarm-run': function(e)
      {
        ActionFormView.showDialog({
          actionKey: 'run',
          model: this.getModelFromEvent(e),
          labelProperty: 'name',
          nlsDomain: 'alarms'
        });

        e.preventDefault();
      },
      'click .action-alarm-stop': function(e)
      {
        ActionFormView.showDialog({
          actionKey: 'stop',
          model: this.getModelFromEvent(e),
          labelProperty: 'name',
          nlsDomain: 'alarms',
          formActionSeverity: 'warning'
        });

        e.preventDefault();
      },
      'click .action-delete': function(e)
      {
        ActionFormView.showDeleteDialog({
          model: this.getModelFromEvent(e),
          labelProperty: 'name',
          nlsDomain: 'alarms'
        });

        e.preventDefault();
      }
    }

  });

  AlarmsListView.prototype.initialize = function()
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

  AlarmsListView.prototype.serialize = function()
  {
    var collection = this.model;

    return {
      className: 'alarms-list',
      columns: this.serializeColumns(),
      actions: this.serializeActions(),
      rows: collection.toJSON().map(function(alarm)
      {
        alarm.className = 'alarms-list-item'
          + (alarm.severity ? (' ' + alarm.severity) : '');

        alarm.data = {
          id: alarm._id,
          state: alarm.state
        };
        alarm.stateText = t('alarms', 'PROPERTY_STATE:' + alarm.state);
        alarm.lastStateChangeTimeText =
          moment(alarm.lastStateChangeTime).format('YYYY-MM-DD HH:mm:ss');

        return alarm;
      })
    };
  };

  AlarmsListView.prototype.afterRender = function()
  {
    this.$('.table-striped').removeClass('table-striped');
  };

  /**
   * @private
   * @returns {Array.<object>}
   */
  AlarmsListView.prototype.serializeColumns = function()
  {
    var columns = [{
      id: 'name',
      label: this.options.nameLabel
        ? this.options.nameLabel
        : t('alarms', 'PROPERTY_NAME')
    }];

    if (this.options.hideStateColumn !== true)
    {
      columns.push({id: 'stateText', label: t('alarms', 'PROPERTY_STATE')});
    }

    columns.push({
      id: 'lastStateChangeTimeText',
      label: this.options.lastStateChangeTimeLabel
        ? this.options.lastStateChangeTimeLabel
        : t('alarms', 'PROPERTY_LAST_STATE_CHANGE_TIME')
    });

    return columns;
  };

  /**
   * @private
   * @returns {Array.<object>}
   */
  AlarmsListView.prototype.serializeActions = function()
  {
    var showManageActions = this.options.hideManageActions !== true
      && user.isAllowedTo('ALARMS_MANAGE');

    return function(row)
    {
      var actions = [];

      if (row.stopConditionMode === Alarm.StopConditionMode.MANUAL
        && user.isAllowedTo('ALARMS_ACK'))
      {
        actions.push({
          id: 'alarm-ack',
          icon: 'thumbs-up',
          label: t('alarms', 'ACTION_ACK'),
          href: '#alarms/' + row._id + ';ack'
        });
      }

      if (showManageActions)
      {
        actions.push(
          {
            id: 'alarm-run',
            icon: 'play',
            label: t('alarms', 'ACTION_RUN'),
            href: '#alarms/' + row._id + ';run'
          },
          {
            id: 'alarm-stop',
            icon: 'pause',
            label: t('alarms', 'ACTION_STOP'),
            href: '#alarms/' + row._id + ';stop'
          }
        );
      }

      actions.push({
        id: 'view-details',
        icon: 'file-alt',
        label: t('core', 'ACTION_VIEW_DETAILS'),
        href: '#alarms/' + row._id
      });

      if (showManageActions)
      {
        actions.push(
          {
            id: 'edit',
            icon: 'edit',
            label: t('core', 'ACTION_EDIT'),
            href: '#alarms/' + row._id + ';edit'
          },
          {
            id: 'delete',
            icon: 'remove',
            label: t('core', 'ACTION_DELETE'),
            href: '#alarms/' + row._id + ';delete'
          }
        );
      }

      return actions;
    };
  };

  /**
   * @private
   */
  AlarmsListView.prototype.refreshCollection = function()
  {
    var now = Date.now();
    var diff = now - this.lastRefreshAt;

    if (now - this.lastRefreshAt < 1000)
    {
      this.timers.refreshCollection =
        setTimeout(this.refreshCollection.bind(this), 1000 - diff);
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
  AlarmsListView.prototype.getModelFromEvent = function(e)
  {
    return this.model.get(
      this.$(e.target).closest('.alarms-list-item').attr('data-id')
    );
  };

  return AlarmsListView;
});
