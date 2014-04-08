// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var lodash = require('lodash');
var ObjectID = require('mongodb').ObjectID;
var step = require('h5.step');
var mongoSerializer = require('h5.rql/lib/serializers/mongoSerializer');

module.exports = function startTagsRoutes(app, controllerModule)
{
  var express = app[controllerModule.config.expressId];
  var mongoose = app[controllerModule.config.mongooseId];
  var user = app[controllerModule.config.userId];

  var canView = user.auth();

  express.get('/tags', canView, browseRoute);

  express.get('/tags/:tag/metric', canView, getTagMetricRoute);

  express.get('/tags/:tag/changes', canView, getTagChangesRoute);

  /**
   * @private
   * @param {object} req
   * @param {object} res
   */
  function browseRoute(req, res)
  {
    var tags = lodash.values(controllerModule.tags);

    res.send({
      totalCount: tags.length,
      collection: tags
    });
  }

  /**
   * @private
   * @param {object} req
   * @param {object} res
   * @param {function(Error=)} next
   */
  function getTagMetricRoute(req, res, next)
  {
    var tagName = req.params.tag;

    if (!lodash.isString(tagName) || tagName.length === 0)
    {
      return next(new Error('UNKNOWN_TAG'));
    }

    var start = parseInt(req.query.start, 10);
    var stop = parseInt(req.query.stop, 10);
    var step = parseInt(req.query.step, 10);

    if (isNaN(stop) || stop < 0)
    {
      stop = Date.now();
    }

    if (isNaN(start) || start >= stop)
    {
      start = stop - 3600 * 1000;
    }

    if (isNaN(step) || step < 60000)
    {
      step = 60000;
    }

    var collection =
      mongoose.connection.db.collection('tags.' + tagName + '.avg');
    var query = {
      _id: {
        $gte: ObjectID.createFromTime(Math.round(start / 1000)),
        $lte: ObjectID.createFromTime(Math.round(stop / 1000))
      }
    };
    var fields = {};
    var valueField = mapValueField(req.query.valueField);

    fields[valueField] = 1;

    collection.find(query, fields).toArray(function(err, docs)
    {
      if (err)
      {
        return next(err);
      }

      res.send(prepareMetrics(docs, valueField, stop, step));
    });
  }

  /**
   * @private
   * @param {object} req
   * @param {object} res
   * @param {function(Error=)} next
   */
  function getTagChangesRoute(req, res, next)
  {
    var tag = controllerModule.tags[req.params.tag];

    if (!tag)
    {
      return next(new Error('UNKNOWN_TAG'));
    }

    if (!tag.archive)
    {
      return next(new Error('TAG_NOT_ARCHIVED'));
    }

    var queryOptions = prepareChangesQueryOptions(req.rql, tag);
    var collectionName = tag.archive === 'all'
      ? 'tags.all'
      : ('tags.' + tag.name + '.avg');
    var collection = mongoose.connection.db.collection(collectionName);

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
              collection: (documents || []).map(function(document)
              {
                if (tag.archive === 'avg')
                {
                  document.t = document._id.getTimestamp().getTime();
                }

                document._id = undefined;

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
   * @returns {string}
   */
  function mapValueField(valueField)
  {
    /*jshint -W015*/

    switch (valueField)
    {
      case 'min':
      case 'n':
        return 'n';

      case 'max':
      case 'x':
        return 'x';

      default:
        return 'v';
    }
  }

  /**
   * @private
   * @param {Array.<object>} docs
   * @param {string} valueField
   * @param {number} stop
   * @param {number} step
   * @returns {Array.<number|null>}
   */
  function prepareMetrics(docs, valueField, stop, step)
  {
    if (docs.length === 0)
    {
      return [];
    }

    var metrics = [];
    var prevDocTime = null;
    var prevValue = null;

    for (var i = 0, l = docs.length; i < l; ++i)
    {
      var doc = docs[i];
      var docTime = doc._id.getTimestamp().getTime();

      if (prevDocTime !== null)
      {
        var missingMiddleMetrics =
          Math.ceil((docTime - prevDocTime) / step) - 1;

        if (missingMiddleMetrics > 0)
        {
          while (missingMiddleMetrics--)
          {
            metrics.push(null);
          }
        }
      }

      prevDocTime = docTime;
      prevValue = doc[valueField];

      metrics.push(prevValue);
    }

    var lastMetricTime = docs[docs.length - 1]._id.getTimestamp().getTime();
    var missingRightMetrics = Math.ceil((stop - lastMetricTime) / step) - 1;

    for (var j = 1; j < missingRightMetrics; ++j)
    {
      metrics.push(null);
    }

    return metrics;
  }

  /**
   * @private
   * @param {h5.rql.Query} rql
   * @param {object} tag
   * @returns {object}
   */
  function prepareChangesQueryOptions(rql, tag)
  {
    var queryOptions = mongoSerializer.fromQuery(rql);

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

      var t = queryOptions.selector.t;

      if (typeof t === 'object')
      {
        queryOptions.selector._id = {};

        Object.keys(t).forEach(function(op)
        {
          var value = t[op];

          if (typeof value !== 'number'
            || ['$gt', '$gte', '$lt', '$lte'].indexOf(op) === -1)
          {
            return;
          }

          queryOptions.selector._id[op] =
            ObjectID.createFromTime(Math.round(value / 1000));
        });

        delete queryOptions.selector.t;
      }
    }

    return queryOptions;
  }
};
