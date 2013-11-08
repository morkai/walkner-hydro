define([
  'underscore',
  'jquery',
  'form2js',
  'js2form',
  'app/i18n',
  'app/viewport',
  'app/core/View',
  './MessageActionFormView',
  './SeverityActionFormView',
  'app/alarms/templates/form',
  'app/alarms/templates/actionControls',
  'jquery.typeahead',
  'i18n!app/nls/alarms'
], function(
  _,
  $,
  form2js,
  js2form,
  t,
  viewport,
  View,
  MessageActionFormView,
  SeverityActionFormView,
  formTemplate,
  actionControlsTemplate
) {
  'use strict';

  var SEVERITY_TO_BTN_CLASS = {
    debug: 'btn-debug',
    info: 'btn-info',
    success: 'btn-success',
    warning: 'btn-warning',
    error: 'btn-danger'
  };

  /**
   * @name app.alarms.views.AlarmFormView
   * @constructor
   * @extends {app.views.View}
   * @param {object} [options]
   */
  var AlarmFormView = View.extend({

    template: formTemplate,

    events: {
      'submit': 'submitForm',
      'change input[name="stopConditionMode"]': function()
      {
        this.toggleStopConditionState();
      },
      'click .alarms-form-actions-add': function()
      {
        this.addAction(this.$('#' + this.idPrefix + '-actions-type').val());
      },
      'click .alarms-form-action-controls-remove': function(e)
      {
        this.removeAction(this.$(e.target).closest('.alarms-form-action'));
      },
      'click .alarms-form-action-controls-up': function(e)
      {
        this.moveActionUp(this.$(e.target).closest('.alarms-form-action'));
      },
      'click .alarms-form-action-controls-down': function(e)
      {
        this.moveActionDown(this.$(e.target).closest('.alarms-form-action'));
      },
      'click .severity': function(e)
      {
        var $target = this.$(e.target);

        this.changeActionSeverity(
          $target.closest('.alarms-form-action'),
          $target.closest('.severity').attr('data-severity')
        );
      }
    }

  });

  AlarmFormView.prototype.initialize = function()
  {
    /**
     * @private
     * @type {string}
     */
    this.idPrefix = _.uniqueId('alarms-form');

    /**
     * @private
     * @type {number}
     */
    this.lastActionIndex = 0;

    /**
     * @private
     * @type {jQuery|null}
     */
    this.$errorMessage = null;

    /**
     * @private
     * @type {function}
     */
    this.scheduleResizeArrow = _.debounce(this.resizeArrow.bind(this), 100);

    $(window).on('resize', this.scheduleResizeArrow);
  };

  AlarmFormView.prototype.destroy = function()
  {
    $(window).off('resize', this.resizeArrow);

    this.$errorMessage = null;
  };

  AlarmFormView.prototype.afterRender = function()
  {
    var alarm = this.model.alarm.toJSON();

    for (var i = 0; i < alarm.startActions.length; ++i)
    {
      this.addAction(alarm.startActions[i].type, alarm.startActions[i]);
    }

    js2form(this.el, alarm);

    this.toggleStopConditionState();
    this.resizeArrow();
  };

  AlarmFormView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      formMethod: this.options.formMethod,
      formAction: this.options.formAction,
      formActionText: this.options.formActionText
    };
  };

  /**
   * @private
   * @param {jQuery.Event} e
   * @returns {boolean}
   */
  AlarmFormView.prototype.submitForm = function(e)
  {
    e.preventDefault();

    if (this.$errorMessage !== null)
    {
      viewport.msg.hide(this.$errorMessage);

      this.$errorMessage = null;
    }

    if (!this.el.checkValidity())
    {
      return false;
    }

    var $submitEl = this.$('[type="submit"]').attr('disabled', true);

    var req = $.ajax({
      type: this.options.formMethod,
      url: this.el.action,
      data: JSON.stringify(form2js(this.el))
    });

    var broker = this.broker;

    req.done(function(res)
    {
      broker.publish('router.navigate', {
        url: '/alarms/' + res._id,
        trigger: true
      });
    });

    var alarmFormView = this;

    req.fail(function(jqXhr)
    {
      var error = jqXhr.responseJSON ? jqXhr.responseJSON.error : null;

      alarmFormView.$errorMessage = viewport.msg.show({
        type: 'error',
        text: error && error.code
          ? alarmFormView.options.failureText(error)
          : alarmFormView.options.genericFailureText
      });
    });

    req.always(function()
    {
      $submitEl.attr('disabled', false);
    });

    return false;
  };

  /**
   * @private
   */
  AlarmFormView.prototype.toggleStopConditionState = function()
  {
    this.$('#' + this.idPrefix + '-stopCondition').attr(
      'disabled',
      this.$('input[name="stopConditionMode"]:checked').val() !== 'specified'
    );
  };

  /**
   * @private
   * @param {string} actionType
   * @param {object} [actionModel]
   */
  AlarmFormView.prototype.addAction = function(actionType, actionModel)
  {
    /*jshint -W015*/

    var actionView = null;

    switch (actionType)
    {
      case 'sms':
      case 'email':
        actionView = new MessageActionFormView({
          actionType: actionType,
          extraUserProperty: actionType === 'sms' ? 'mobile' : 'email',
          index: ++this.lastActionIndex,
          model: {
            action: actionModel,
            users: this.model.users
          }
        });
        break;

      case 'severity':
        actionView = new SeverityActionFormView({
          index: ++this.lastActionIndex
        });
        break;

      default:
        return;
    }

    this.insertView('.alarms-form-actions', actionView);

    actionView.render();
    actionView.$el.append(actionControlsTemplate());
    actionView.$el.find('.alarms-form-action-controls-severity').dropdown();

    this.changeActionSeverity(
      actionView.$el, actionModel ? actionModel.severity : 'warning'
    );

    var resizeArrow = this.resizeArrow.bind(this);

    function resize()
    {
      actionView.on('resize', resizeArrow);
      resizeArrow();
    }

    if (actionModel)
    {
      resize();
    }
    else
    {
      actionView.$el.hide().fadeIn(resize);
    }
  };

  /**
   * @private
   */
  AlarmFormView.prototype.resizeArrow = function()
  {
    var $arrow = this.$('.alarms-form-actions-arrow');
    var $actions = this.$('.alarms-form-actions');

    $arrow.height($actions.outerHeight(true) + 15);

    this.$('.alarms-form-actions-control-group').toggleClass(
      'alarms-form-actions-empty', $actions.children().length === 0
    );
  };

  /**
   * @private
   * @param {jQuery} $action
   * @param {string} newSeverity
   */
  AlarmFormView.prototype.changeActionSeverity = function($action, newSeverity)
  {
    var $severityValue = $action.find('.alarms-form-action-severity');
    var oldSeverity = $severityValue.val();
    var $severityControl =
      $action.find('.alarms-form-action-controls-severity');

    $severityControl.removeClass(SEVERITY_TO_BTN_CLASS[oldSeverity]);
    $severityControl.addClass(SEVERITY_TO_BTN_CLASS[newSeverity]);

    $severityValue.val(newSeverity);
  };

  /**
   * @private
   * @param {jQuery} $action
   */
  AlarmFormView.prototype.removeAction = function($action)
  {
    var alarmFormView = this;
    var actionView = this.getViews({el: $action[0]}).first().value();

    $action.find('.alarms-form-action-controls-remove').attr('disabled', true);
    $action.fadeOut(function()
    {
      actionView.remove();
      alarmFormView.resizeArrow();
    });
  };

  /**
   * @private
   * @param {jQuery} $action
   */
  AlarmFormView.prototype.moveActionUp = function($action)
  {
    var $actions = this.$('.alarms-form-action');

    if ($actions.length === 1)
    {
      return;
    }

    var alarmFormView = this;
    var $control = $action.find('.alarms-form-action-controls-up');

    $control.attr('disabled', true);
    $action.fadeOut('fast', function()
    {
      var $prevAction = $action.prev();

      if ($prevAction.length === 0)
      {
        $action.insertAfter($actions.last());
      }
      else
      {
        $action.insertBefore($prevAction);
      }

      $control.attr('disabled', false);
      $action.fadeIn('fast', function()
      {
        alarmFormView.resizeArrow();
      });
    });
  };

  /**
   * @private
   * @param {jQuery} $action
   */
  AlarmFormView.prototype.moveActionDown = function($action)
  {
    var $actions = this.$('.alarms-form-action');

    if ($actions.length === 1)
    {
      return;
    }

    var alarmFormView = this;
    var $control = $action.find('.alarms-form-action-controls-up');

    $control.attr('disabled', true);
    $action.fadeOut('fast', function()
    {
      var $nextAction = $action.next();

      if ($nextAction.length === 0)
      {
        $action.insertBefore($actions.first());
      }
      else
      {
        $action.insertAfter($nextAction);
      }

      $control.attr('disabled', false);
      $action.fadeIn('fast', function()
      {
        alarmFormView.resizeArrow();
      });
    });
  };

  return AlarmFormView;
});
