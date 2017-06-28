// Part of <https://miracle.systems/p/walkner-furmon> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const moment = require('moment');
const ObjectID = require('mongodb').ObjectID;
const step = require('h5.step');
const mongoSerializer = require('h5.rql/lib/serializers/mongoSerializer');

module.exports = function startControllerRoutes(app, module)
{
  var express = app[module.config.expressId];
  var mongoose = app[module.config.mongooseId];
  var user = app[module.config.userId];

  const fieldMaps = {
    valueMinutely: {
      min: 'n',
      n: 'n',
      max: 'x',
      x: 'x',
      avg: 'v',
      v: 'v'
    },
    value: {
      min: 'min',
      n: 'min',
      max: 'max',
      x: 'max',
      avg: 'avg',
      v: 'avg'
    },
    deltaMinutely: {
      min: 'dn',
      n: 'dn',
      max: 'dx',
      x: 'dx',
      avg: 'dv',
      v: 'dv'
    },
    delta: {
      min: 'dMin',
      n: 'dMin',
      dmin: 'dMin',
      dn: 'dMin',
      max: 'dMax',
      x: 'dMax',
      dmax: 'dMax',
      dx: 'dMax',
      avg: 'dAvg',
      v: 'dAvg',
      davg: 'dAvg',
      dV: 'dAvg'
    }
  };

  var canView = user.auth();

  express.get('/tags', canView, browseRoute);

  express.get('/tags/:tag/metric', canView, getTagMetricRoute);

  express.get('/tags/:tag/changes', canView, getTagChangesRoute);

  /**
   * @private
   * @param {Object} req
   * @param {Object} res
   */
  function browseRoute(req, res)
  {
    var tags = _.values(module.tags);

    res.send({
      totalCount: tags.length,
      collection: tags
    });
  }

  /**
   * @private
   * @param {Object} req
   * @param {Object} res
   * @param {function(?Error)} next
   */
  function getTagMetricRoute(req, res, next)
  {
    const tagName = req.params.tag;

    if (!_.isString(tagName) || tagName.length === 0)
    {
      next(new Error('UNKNOWN_TAG'));

      return;
    }

    const minute = 60;
    const hour = minute * 60;
    const day = hour * 24;
    const month = day * 31;

    const now = Date.now();
    let start = moment(parseInt(req.query.start, 10)).startOf('minute').valueOf();
    let stop = moment(parseInt(req.query.stop, 10)).startOf('minute').valueOf();
    let step = minute;
    let interval = 'minutely';

    if (isNaN(start) || start < 0)
    {
      next(new Error('INVALID_START'));

      return;
    }

    if (isNaN(stop) || stop <= 0 || stop > now)
    {
      stop = moment(now).startOf('minute').valueOf();
    }

    if (start >= stop)
    {
      stop = start + 60000;
    }

    start = Math.floor(start / 1000) * 1000;
    stop = Math.floor(stop / 1000) * 1000;

    const timeDiff = (stop - start) / 1000;

    if (req.query.step !== '60000')
    {
      if (timeDiff > month)
      {
        step = day;
        interval = 'daily';
      }
      else if (timeDiff > day)
      {
        step = hour;
        interval = 'hourly';
      }
    }

    step *= 1000;

    const minutely = interval === 'minutely';
    const collection = mongoose.connection.db.collection(minutely ? `tags.${tagName}.avg` : `tags.avg.${interval}`);
    const query = minutely ? {
      _id: {
        $gte: ObjectID.createFromTime(Math.floor(start / 1000)),
        $lt: ObjectID.createFromTime(Math.floor(stop / 1000))
      }
    } : {
      tag: tagName,
      time: {
        $gte: start,
        $lt: stop
      }
    };
    const valueField = mapValueField(req.query.valueField || 'v', minutely);
    const deltaField = mapDeltaField(req.query.deltaField || '', minutely);
    const fields = {
      [valueField]: 1
    };

    if (deltaField)
    {
      fields[deltaField] = 1;
    }

    if (!minutely)
    {
      fields.time = 1;
    }

    collection.find(query).project(fields).toArray(function(err, docs)
    {
      if (err)
      {
        next(err);

        return;
      }

      res.send(prepareMetrics(docs, valueField, deltaField, start, stop, step, interval));
    });
  }

  /**
   * @private
   * @param {Object} req
   * @param {Object} res
   * @param {function(?Error)} next
   * @returns {undefined}
   */
  function getTagChangesRoute(req, res, next)
  {
    const tag = module.tags[req.params.tag];

    if (!tag)
    {
      return next(new Error('UNKNOWN_TAG'));
    }

    if (!tag.archive)
    {
      return next(new Error('TAG_NOT_ARCHIVED'));
    }

    const queryOptions = prepareChangesQueryOptions(req.rql, tag);
    const collectionName = tag.archive === 'all'
      ? 'tags.all'
      : `tags.${tag.name}.avg`;
    const collection = mongoose.connection.db.collection(collectionName);

    step(
      function countStep()
      {
        collection.count(queryOptions.selector, this.next());
      },
      function findStep(err, totalCount)
      {
        if (err)
        {
          return this.done(next, err);
        }

        this.totalCount = totalCount;

        if (totalCount > 0)
        {
          collection
            .find(queryOptions.selector, null, queryOptions)
            .toArray(this.next());
        }
      },
      function sendResponseStep(err, documents)
      {
        if (err)
        {
          return this.done(next, err);
        }

        var totalCount = this.totalCount;

        res.format({
          json: function()
          {
            res.json({
              totalCount: totalCount,
              collection: _.map(documents, function(document)
              {
                if (tag.archive === 'avg')
                {
                  document.t = document._id.getTimestamp().getTime();
                }

                document._id = undefined; // eslint-disable-line no-undefined

                return document;
              })
            });
          }
        });
      }
    );
  }

  /**
   * @private
   * @param {string} valueField
   * @param {boolean} minutely
   * @returns {string}
   */
  function mapValueField(valueField, minutely)
  {
    return minutely
      ? (fieldMaps.valueMinutely[valueField.toLowerCase()] || 'v')
      : (fieldMaps.value[valueField.toLowerCase()] || 'avg');
  }

  /**
   * @private
   * @param {string} deltaField
   * @param {boolean} minutely
   * @returns {?string}
   */
  function mapDeltaField(deltaField, minutely)
  {
    return !deltaField ? null : minutely
      ? (fieldMaps.deltaMinutely[deltaField.toLowerCase()] || null)
      : (fieldMaps.delta[deltaField.toLowerCase()] || null);
  }

  /**
   * @private
   * @param {Array<Object>} docs
   * @param {string} valueField
   * @param {?string} deltaField
   * @param {number} start
   * @param {number} stop
   * @param {number} step
   * @param {string} interval
   * @returns {Object}
   */
  function prepareMetrics(docs, valueField, deltaField, start, stop, step, interval)
  {
    const getMetricTime = interval === 'minutely' ? getMetricTimeFromId : getMetricTimeFromTime;
    const metrics = [];
    const deltas = [];
    const withDelta = deltaField !== null;
    const result = {
      start: start,
      stop: stop,
      step: step,
      interval: interval,
      valueField: mapValueField(valueField, false),
      deltaField: mapDeltaField(deltaField, false),
      firstTime: docs.length ? getMetricTime(docs[0]) : -1,
      lastTime: docs.length ? getMetricTime(docs[docs.length - 1]) : -1,
      totalCount: Math.ceil((stop - start) / step),
      missingRight: 0,
      missingLeft: 0,
      minValue: Number.MAX_SAFE_INTEGER,
      maxValue: Number.MIN_SAFE_INTEGER,
      values: metrics,
      dMinValue: Number.MAX_SAFE_INTEGER,
      dMaxValue: Number.MIN_SAFE_INTEGER,
      deltas: deltas
    };

    if (docs.length === 0)
    {
      return result;
    }

    let prevDocTime = null;
    let prevValue = null;
    let dPrevValue = null;

    for (var i = 0, l = docs.length; i < l; ++i)
    {
      const doc = docs[i];
      const docTime = getMetricTime(doc);

      if (prevDocTime !== null)
      {
        let missingMiddleMetrics = Math.ceil((docTime - prevDocTime) / step) - 1;

        if (missingMiddleMetrics > 0)
        {
          while (missingMiddleMetrics--)
          {
            metrics.push(null);

            if (withDelta)
            {
              deltas.push(null);
            }
          }
        }
      }

      prevDocTime = docTime;
      prevValue = doc[valueField];

      if (prevValue > result.maxValue)
      {
        result.maxValue = prevValue;
      }

      if (prevValue < result.minValue)
      {
        result.minValue = prevValue;
      }

      metrics.push(prevValue);

      if (withDelta)
      {
        dPrevValue = doc[deltaField];

        if (dPrevValue > result.dMaxValue)
        {
          result.dMaxValue = dPrevValue;
        }

        if (dPrevValue < result.dMinValue)
        {
          result.dMinValue = dPrevValue;
        }

        deltas.push(dPrevValue);
      }
    }

    const missingRightMetrics = Math.ceil((stop - (result.lastTime === -1 ? start : result.lastTime)) / step) - 1;

    result.missingRight = missingRightMetrics;
    result.missingLeft = result.totalCount - metrics.length - missingRightMetrics;

    return result;
  }

  function getMetricTimeFromId(doc)
  {
    return doc._id.getTimestamp().getTime();
  }

  function getMetricTimeFromTime(doc)
  {
    return doc.time;
  }

  /**
   * @private
   * @param {h5.rql.Query} rql
   * @param {Object} tag
   * @returns {Object}
   */
  function prepareChangesQueryOptions(rql, tag)
  {
    const queryOptions = mongoSerializer.fromQuery(rql);

    if (tag.archive === 'all')
    {
      queryOptions.selector.n = tag.name;
      queryOptions.fields = {t: 1, v: 1};
      queryOptions.sort = {t: -1};
    }
    else
    {
      queryOptions.fields = {s: 1, n: 1, x: 1, v: 1};
      queryOptions.sort = {_id: -1};

      const t = queryOptions.selector.t;

      if (typeof t === 'object')
      {
        queryOptions.selector._id = {};

        _.forEach(t, function(value, op)
        {
          if (typeof value !== 'number' || !_.includes(['$gt', '$gte', '$lt', '$lte'], op))
          {
            return;
          }

          queryOptions.selector._id[op] = ObjectID.createFromTime(Math.round(value / 1000));
        });

        delete queryOptions.selector.t;
      }
    }

    return queryOptions;
  }
};
