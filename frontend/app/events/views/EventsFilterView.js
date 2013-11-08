define([
  'underscore',
  'moment',
  'js2form',
  'app/i18n',
  'app/core/View',
  'app/events/templates/filter',
  'i18n!app/nls/events'
], function(
  _,
  moment,
  js2form,
  t,
  View,
  filterTemplate
) {
  'use strict';

  /**
   * @name app.events.views.EventsFilterView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var EventsFilterView = View.extend({

    template: filterTemplate,

    events: {
      'submit .events-filter-form': function(e)
      {
        e.preventDefault();
        this.changeFilter();
      }
    }

  });

  EventsFilterView.prototype.initialize = function()
  {
    this.idPrefix = _.uniqueId('events-filter');
  };

  EventsFilterView.prototype.serialize = function()
  {
    return {
      idPrefix: this.idPrefix,
      types: this.model.eventTypes.toJSON(),
      users: this.model.users.toJSON()
    };
  };

  EventsFilterView.prototype.afterRender = function()
  {
    var rqlQuery = this.model.rqlQuery;
    var formData = {
      type: '$ANY',
      user: '$ANY',
      limit:
        rqlQuery.limit < 5 ? 5 : (rqlQuery.limit > 100 ? 100 : rqlQuery.limit),
      severity: []
    };

    rqlQuery.selector.args.forEach(function(term)
    {
      /*jshint -W015*/

      var property = term.args[0];

      switch (property)
      {
        case 'time':
          formData[term.name === 'ge' ? 'from' : 'to'] =
            moment(term.args[1]).format('YYYY-MM-DD HH:mm:ss');
          break;

        case 'type':
          formData.type = term.args[1];
          break;

        case 'user':
          formData.user = term.args[1] === null ? '$SYSTEM' : term.args[1];
          break;

        case 'severity':
          formData.severity =
            term.name === 'eq' ? [term.args[1]] : term.args[1];
          break;
      }
    });

    js2form(this.el.querySelector('.events-filter-form'), formData);

    this.toggleSeverity(formData.severity);
  };

  /**
   * @private
   */
  EventsFilterView.prototype.changeFilter = function()
  {
    var rqlQuery = this.model.rqlQuery;
    var timeRange = this.fixTimeRange();
    var selector = [];
    var type = this.$('#' + this.idPrefix + '-type').val();
    var user = this.$('#' + this.idPrefix + '-user').val();
    var severity = this.fixSeverity();

    if (type !== '$ANY')
    {
      selector.push({name: 'eq', args: ['type', type]});
    }

    if (user === '$SYSTEM')
    {
      selector.push({name: 'eq', args: ['user', null]});
    }
    else if (user !== '$ANY')
    {
      selector.push({name: 'eq', args: ['user.login', user]});
    }

    if (timeRange.from !== -1)
    {
      selector.push({name: 'ge', args: ['time', timeRange.from]});
    }

    if (timeRange.to !== -1)
    {
      selector.push({name: 'le', args: ['time', timeRange.to]});
    }

    if (severity.length === 1)
    {
      selector.push({name: 'eq', args: ['severity', severity[0]]});
    }
    else if (severity.length > 1)
    {
      selector.push({name: 'in', args: ['severity', severity]});
    }

    rqlQuery.selector = {name: 'and', args: selector};
    rqlQuery.limit = parseInt(this.$('#' + this.idPrefix + '-limit').val(), 10);
    rqlQuery.skip = 0;

    this.trigger('filterChanged', rqlQuery);
  };

  /**
   * @private
   */
  EventsFilterView.prototype.fixTimeRange = function()
  {
    var timeRange = {
      from: -1,
      to: -1
    };

    var $from = this.$('#' + this.idPrefix + '-from');
    var $to = this.$('#' + this.idPrefix + '-to');

    var from = moment($from.val());
    var to = moment($to.val());

    if (from.isValid())
    {
      $from.val(from.format('YYYY-MM-DD HH:mm:ss'));

      timeRange.from = from.valueOf();
    }
    else
    {
      $from.val('');
    }

    if (to.isValid())
    {
      if (from.valueOf() === to.valueOf())
      {
        to.add('days', 1);
      }

      $to.val(to.format('YYYY-MM-DD HH:mm:ss'));

      timeRange.to = to.valueOf();
    }
    else
    {
      $to.val('');
    }

    return timeRange;
  };

  /**
   * @private
   */
  EventsFilterView.prototype.fixSeverity = function()
  {
    var $allSeverity = this.$('.events-form-severity');
    var $activeSeverity = $allSeverity.filter('.active');

    if ($activeSeverity.length === 0)
    {
      $allSeverity.addClass('active');
    }

    var selectedSeverity = $activeSeverity
      .map(function()
      {
        return this.getAttribute('title').toLowerCase();
      })
      .get();

    return selectedSeverity.length === $allSeverity.length
      ? []
      : selectedSeverity;
  };

  /**
   * @private
   * @param {Array.<string>} severities
   */
  EventsFilterView.prototype.toggleSeverity = function(severities)
  {
    var $allSeverity = this.$('.events-form-severity');

    if (severities.length === 0)
    {
      $allSeverity.addClass('active');
    }
    else
    {
      severities.forEach(function(severity)
      {
        $allSeverity
          .filter('[title="' + severity.toUpperCase() + '"]')
          .addClass('active');
      });
    }
  };

  return EventsFilterView;
});
