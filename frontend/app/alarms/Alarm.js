define([
  '../time',
  '../core/Model'
], function(
  time,
  Model
) {
  'use strict';

  /**
   * @enum {number}
   */
  var AlarmState = {
    STOPPED: 0,
    RUNNING: 1,
    ACTIVE: 2
  };

  /**
   * @enum {string}
   */
  var AlarmStopConditionMode = {
    MANUAL: 'manual',
    NEGATED: 'negated',
    SPECIFIED: 'specified'
  };

  /**
   * @name app.alarms.Alarm
   * @constructor
   * @extends {app.core.Model}
   * @param {object} [attributes]
   */
  var Alarm = Model.extend({

    urlRoot: '/alarms',

    defaults: {
      name: '',
      state: AlarmState.STOPPED,
      severity: null,
      actionIndex: -1,
      lastStateChangeTime: 0,
      startCondition: '',
      startActions: [],
      stopConditionMode: AlarmStopConditionMode.NEGATED,
      stopCondition: '',
      stopActions: []
    }

  });

  Alarm.State = AlarmState;
  Alarm.StopConditionMode = AlarmStopConditionMode;

  return Alarm;
});
