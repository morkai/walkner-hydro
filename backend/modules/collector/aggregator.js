'use strict';

/*jshint maxparams:5*/

var lodash = require('lodash');
var ObjectID = require('mongodb').ObjectID;
var step = require('h5.step');

module.exports = function setUpAggregator(app, collectorModule)
{
  /**
   * @private
   * @type {object.<string, Tag>}
   */
  var tags = app[collectorModule.config.modbusId].tags;

  /**
   * @private
   * @type {Array.<string>}
   */
  var avgTagNames = getAvgTagNames();

  /**
   * @private
   * @type {function(string): Collection}
   */
  var collection = collectorModule.config.collection;

  /**
   * @private
   * @type {Array.<TagInfo>}
   */
  var collectorInfo = [];

  step(
    function ensureIndexesStep()
    {
      ensureIndex(collection('tags.avg.hourly'), this.parallel());
      ensureIndex(collection('tags.avg.daily'), this.parallel());
      ensureIndex(collection('tags.avg.monthly'), this.parallel());
    },
    function fetchCollectorInfoStep()
    {
      collection('collectorInfo')
        .find({_id: {$in: avgTagNames}})
        .toArray(this.next());
    },
    function prefillCollectorInfoStep(err, rawCollectorInfo)
    {
      if (err)
      {
        collectorModule.error("Failed to fetch collector info: %s", err.message);

        return this.done(null);
      }

      var existingTagNames = lodash.pluck(rawCollectorInfo, '_id');
      var missingTagNames =
        lodash.without.apply(null, [avgTagNames].concat(existingTagNames));

      collectorInfo = rawCollectorInfo;

      missingTagNames.forEach(function(missingTagName)
      {
        collectorInfo.push({
          _id: missingTagName,
          lastHourly: 0,
          lastDaily: 0,
          lastMonthly: 0
        });
      });

      setImmediate(this.next());
    },
    function aggregateMissingDataStep()
    {
      var step = this;

      collectorInfo.forEach(function(tagInfo)
      {
        aggregateMissingTagData(tagInfo, step.parallel());
      });
    },
    function scheduleNextAggregationStep(err)
    {
      if (err)
      {
        collectorModule.error("Failed to aggregate data: %s", err.message);
      }

      scheduleNextAggregation();
    }
  );

  /**
   * @private
   * @param {Collection} levelCollection
   * @param {function} done
   */
  function ensureIndex(levelCollection, done)
  {
    var options = {unique: true, dropDups: true};

    levelCollection.ensureIndex({tag: 1, time: 1}, options, function(err)
    {
      if (err)
      {
        collectorModule.error(
          "Failed to ensure indexes for collection %s: %s",
          levelCollection.name,
          err.message
        );
      }

      done();
    });
  }

  /**
   * @private
   * @returns {Array.<string>}
   */
  function getAvgTagNames()
  {
    var tagNames = [];

    Object.keys(tags).forEach(function(tagName)
    {
      var tag = tags[tagName];

      if (tag.archive === 'avg' && tag.kind !== 'setting')
      {
        tagNames.push(tagName);
      }
    });

    return tagNames;
  }

  /**
   * @private
   * @param {TagInfo} tagInfo
   * @param {function(Error|null)} done
   */
  function aggregateMissingTagData(tagInfo, done)
  {
    var steps = [];

    var currentHourly = resetDate(new Date(), false, false);
    var lastHourly = resetDate(new Date(tagInfo.lastHourly), false, false);

    if (lastHourly < currentHourly)
    {
      steps.push(
        lodash.partial(aggregateHourlyDataStep, tagInfo, currentHourly)
      );
    }

    var currentDaily = resetDate(new Date(), true, false);
    var lastDaily = resetDate(new Date(tagInfo.lastDaily), true, false);

    if (lastDaily < currentDaily)
    {
      steps.push(
        lodash.partial(aggregateDailyDataStep, tagInfo, currentDaily)
      );
    }

    var currentMonthly = resetDate(new Date(), true, true);
    var lastMonthly = resetDate(new Date(tagInfo.lastMonthly), true, true);

    if (lastMonthly < currentMonthly)
    {
      steps.push(
        lodash.partial(aggregateMonthlyDataStep, tagInfo, currentMonthly)
      );
    }

    steps.push(done);

    step(steps);
  }

  /**
   * @private
   * @param {TagInfo} tagInfo
   * @param {Date} currentMonthly
   * @param {Error|null} err
   */
  function aggregateMonthlyDataStep(tagInfo, currentMonthly, err)
  {
    /*jshint validthis:true*/

    if (err)
    {
      return this.skip(err);
    }

    var options = {
      from: tagInfo.lastMonthly,
      to: currentMonthly.getTime(),
      tag: tagInfo._id,
      srcCollectionName: 'tags.avg.daily',
      dstCollectionName: 'tags.avg.monthly',
      dstTimeProperty: 'lastMonthly',
      resetDate: lodash.partialRight(resetDate, true, true)
    };

    aggregateAndSaveData(options, this.next());
  }

  /**
   * @private
   * @param {TagInfo} tagInfo
   * @param {Date} currentDaily
   * @param {Error|null} err
   */
  function aggregateDailyDataStep(tagInfo, currentDaily, err)
  {
    /*jshint validthis:true*/

    if (err)
    {
      return this.skip(err);
    }

    var options = {
      from: tagInfo.lastDaily,
      to: currentDaily.getTime(),
      tag: tagInfo._id,
      srcCollectionName: 'tags.avg.hourly',
      dstCollectionName: 'tags.avg.daily',
      dstTimeProperty: 'lastDaily',
      resetDate: lodash.partialRight(resetDate, true, false)
    };

    aggregateAndSaveData(options, this.next());
  }

  /**
   * @private
   * @param {TagInfo} tagInfo
   * @param {Date} currentHourly
   * @param {Error|null} err
   */
  function aggregateHourlyDataStep(tagInfo, currentHourly, err)
  {
    /*jshint validthis:true*/

    if (err)
    {
      return this.skip(err);
    }

    currentHourly = currentHourly.getTime();

    var done = lodash.once(this.next());
    var selector = {
      _id: {
        $gte: ObjectID.createFromTime(Math.floor(tagInfo.lastHourly / 1000)),
        $lt: ObjectID.createFromTime(Math.floor(currentHourly / 1000))
      }
    };
    var fields = {
      _id: 1,
      v: 1,
      n: 1,
      x: 1
    };
    var options = {
      sort: '_id'
    };
    var cursor = collection('tags.' + tagInfo._id + '.avg').find(
      selector, fields, options
    );
    var averagedSrcDocs = [];
    var resetHourlyDate = lodash.partialRight(resetDate, false, false);

    cursor.each(function(err, minuteData)
    {
      if (err)
      {
        return done(err);
      }

      if (minuteData === null)
      {
        var groupedDocs = groupDocs(averagedSrcDocs, resetHourlyDate);
        var averagedDstDocs = averageGroupedDocs(groupedDocs, tagInfo._id);

        return saveAveragedDocs(
          'tags.avg.hourly', 'lastHourly', currentHourly, averagedDstDocs, done
        );
      }

      averagedSrcDocs.push({
        tag: tagInfo._id,
        time: minuteData._id.getTimestamp().getTime(),
        min: minuteData.n,
        max: minuteData.x,
        avg: minuteData.v
      });
    });
  }

  /**
   * @private
   * @param {AggregateDataOptions} options
   * @param {function(Error|null)} done
   */
  function aggregateAndSaveData(options, done)
  {
    var selector = {
      tag: options.tag,
      time: {
        $gte: options.from,
        $lt: options.to
      }
    };

    var cursor = collection(options.srcCollectionName).find(
      selector, null, {sort: 'time'}
    );

    cursor.toArray(function(err, averagedSrcDocs)
    {
      if (err)
      {
        return done(err);
      }

      if (averagedSrcDocs.length === 0)
      {
        return done(null);
      }

      var groupedDocs = groupDocs(averagedSrcDocs, options.resetDate);
      var averagedDstDocs = averageGroupedDocs(groupedDocs, options.tag);

      saveAveragedDocs(
        options.dstCollectionName,
        options.dstTimeProperty,
        options.to,
        averagedDstDocs,
        done
      );
    });
  }

  /**
   * @param {Array.<AveragedDoc>} docs
   * @param {function(Date): Date} resetDate
   * @returns {Array.<GroupedDocs>}
   */
  function groupDocs(docs, resetDate)
  {
    var results = [];
    var lastTime = 0;

    docs.forEach(function(doc)
    {
      var time = resetDate(new Date(doc.time)).getTime();

      if (time > lastTime)
      {
        lastTime = time;

        results.push({
          lastTime: lastTime,
          docs: []
        });
      }

      results[results.length - 1].docs.push(doc);
    });

    return results;
  }

  /**
   * @private
   * @param {Array.<object>} groupedDocs
   * @param {string} tagName
   * @returns {Array.<AveragedDoc>}
   */
  function averageGroupedDocs(groupedDocs, tagName)
  {
    var results = [];

    groupedDocs.forEach(function(group)
    {
      var result = {
        tag: tagName,
        time: group.lastTime,
        min: +Infinity,
        max: -Infinity,
        avg: 0
      };
      var sum = 0;

      group.docs.forEach(function(doc)
      {
        if (doc.min < result.min)
        {
          result.min = doc.min;
        }

        if (doc.max > result.max)
        {
          result.max = doc.max;
        }

        sum += doc.avg;
      });

      result.avg = Math.round((sum / group.docs.length) * 100) / 100;

      results.push(result);
    });

    return results;
  }

  /**
   * @private
   * @param {string} collectionName
   * @param {string} timeProperty
   * @param {number} newTime
   * @param {Array.<AveragedDoc>} averagedDocs
   * @param {function(Error|null)} done
   */
  function saveAveragedDocs(
    collectionName, timeProperty, newTime, averagedDocs, done)
  {
    collection(collectionName).insert(averagedDocs, function(err)
    {
      if (err)
      {
        return done(err);
      }

      var tagName = averagedDocs[averagedDocs.length - 1].tag;
      var tagInfo = lodash.find(collectorInfo, {_id: tagName});
      var oldTime = tagInfo[timeProperty];

      tagInfo[timeProperty] = newTime;

      collection('collectorInfo').save(tagInfo, function(err)
      {
        if (err)
        {
          tagInfo[timeProperty] = oldTime;
        }

        done(err);
      });
    });
  }

  /**
   * @private
   */
  function scheduleNextAggregation()
  {
    var nextAggregationTime =
      +resetDate(new Date(), false, false) + 3660 * 1000;
    var nextAggregationDelay = nextAggregationTime - Date.now();
    var steps = [];

    collectorInfo.forEach(function(tagInfo)
    {
      steps.push(function(err)
      {
        if (err)
        {
          collectorModule.error("Failed to aggregate data: %s", err.message);
        }

        aggregateMissingTagData(tagInfo, this.next());
      });
    });

    steps.push(function(err)
    {
      if (err)
      {
        collectorModule.error("Failed to aggregate data: %s", err.message);
      }
    });

    steps.push(scheduleNextAggregation);

    app.timeout(nextAggregationDelay, lodash.partial(step, steps));
  }

  /**
   * @private
   * @param {Date} date
   * @param {boolean} resetHour
   * @param {boolean} resetDay
   * @returns {Date}
   */
  function resetDate(date, resetHour, resetDay)
  {
    if (resetDay)
    {
      date.setDate(1);
    }

    if (resetHour)
    {
      date.setHours(0);
    }

    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);

    return date;
  }

  /**
   * @typedef {object} TagInfo
   * @property {string} _id
   * @property {number} lastHourly
   * @property {number} lastDaily
   * @property {number} lastMonthly
   */

  /**
   * @typedef {object} AveragedDoc
   * @property {string} tag
   * @property {number} time
   * @property {number} min
   * @property {number} max
   * @property {number} avg
   */

  /**
   * @typedef {object} GroupedDocs
   * @property {number} lastTime
   * @property {Array.<AveragedDoc>} docs
   */

  /**
   * @typedef {object} AggregateDataOptions
   * @property {number} from
   * @property {number} to
   * @property {string} tag
   * @property {string} srcCollectionName
   * @property {string} dstCollectionName
   * @property {string} dstTimeProperty
   * @property {function(Date): Date} resetDate
   */
};

/*
db.tags.outputPumps.current.avg.aggregate(
  {
    $match: {
      _id: {
        $gte: ObjectId("52629e700000000000000000"),
        $lt: ObjectId("5262ac800000000000000000")
      }
    }
  },
  {
    $project: {_id: 0, min: "$n", max: "$x", avg: "$v"}
  },
  {
    $group: {
      _id: null,
      min: {$min: "$min"},
      max: {$max: "$max"},
      avg: {$avg: "$avg"}
    }
  }
);
*/
