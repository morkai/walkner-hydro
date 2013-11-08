define([
  'underscore',
  'moment',
  'app/i18n',
  'app/core/View',
  'app/core/views/PaginationView',
  'app/events/templates/list',
  'i18n!app/nls/events',
  'i18n!app/nls/tags'
], function(
  _,
  moment,
  t,
  View,
  PaginationView,
  listTemplate
) {
  'use strict';

  /**
   * @name app.events.views.EventsListView
   * @constructor
   * @extends {app.core.View}
   * @param {object} [options]
   */
  var EventsListView = View.extend({

    template: listTemplate,

    remoteTopics: {
      'events.saved': 'refreshCollection'
    }

  });

  EventsListView.prototype.initialize = function()
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

  EventsListView.prototype.serialize = function()
  {
    var view = this;

    return {
      events: this.model.map(function(event)
      {
        var type = event.get('type');
        var data = view.prepareData(type, event.get('data'));

        return {
          severity: event.get('severity'),
          time: moment(event.get('time')).format('lll'),
          user: event.get('user'),
          type: t('events', 'TYPE:' + type),
          text: t('events', 'TEXT:' + type, flatten(data) || {})
        };
      })
    };
  };

  /**
   * @private
   * @param {string} type
   * @param {object} data
   */
  EventsListView.prototype.prepareData = function(type, data)
  {
    /*jshint -W015*/

    if (data.$__prepared__)
    {
      return data;
    }

    data.$__prepared__ = true;

    switch (type)
    {
      case 'controller.tagValueSet':
      case 'controller.settingChanged':
        data.tag = t('tags', 'TAG:' + data.tag) + ' (' + data.tag + ')';
        break;
    }

    return data;
  };

  /**
   * @param {Array.<object>|null} events
   * @param {boolean} [force]
   */
  EventsListView.prototype.refreshCollection = function(events, force)
  {
    if (this.options.filter
      && Array.isArray(events)
      && !events.some(this.options.filter))
    {
      return;
    }

    var now = Date.now();
    var diff = now - this.lastRefreshAt;

    if (!force && now - this.lastRefreshAt < 1000)
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

  function flatten(obj)
  {
    if (obj === null)
    {
      return null;
    }

    var result = {};
    var keys = Object.keys(obj);

    for (var i = 0, l = keys.length; i < l; ++i)
    {
      var key = keys[i];
      var value = obj[key];

      if (value !== null && typeof value === 'object')
      {
        var flatObj = flatten(value);
        var flatKeys = Object.keys(flatObj);

        for (var ii = 0, ll = flatKeys.length; ii < ll; ++ii)
        {
          result[key + '->' + flatKeys[ii]] =
            _.escape(String(flatObj[flatKeys[ii]]));
        }
      }
      else
      {
        result[key] = _.escape(String(value));
      }
    }

    return result;
  }

  return EventsListView;
});
