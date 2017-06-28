// Part of <https://miracle.systems/p/walkner-furmon> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const ObjectID = require('mongodb').ObjectID;
const step = require('h5.step');
const round = require('./round');

module.exports = function setUpAggregator(app, module)
{
  /**
   * @private
   * @type {Object<string, Tag>}
   */
  const tags = app[module.config.modbusId].tags;

  /**
   * @private
   * @type {Array<string>}
   */
  const avgTagNames = getAvgTagNames();

  /**
   * @private
   * @type {function(string): Collection}
   */
  const collection = module.config.collection;

  /**
   * @private
   * @type {Array<TagInfo>}
   */
  let collectorInfo = [];

  step(
    function ensureIndexesStep()
    {
      ensureIndex(collection('tags.avg.hourly'), this.parallel());
      ensureIndex(collection('tags.avg.daily'), this.parallel());
      ensureIndex(collection('tags.avg.monthly'), this.parallel());
    },
    function fetchCollectorInfoStep()
    {
      collection('collectorInfo').find({_id: {$in: avgTagNames}}).toArray(this.next());
    },
    function prefillCollectorInfoStep(err, rawCollectorInfo)
    {
      if (err)
      {
        module.error(`Failed to fetch collector info: ${err.message}`);

        return this.done(null);
      }

      const existingTagNames = _.map(rawCollectorInfo, '_id');
      const missingTagNames = _.without.apply(null, [avgTagNames].concat(existingTagNames));

      collectorInfo = rawCollectorInfo;

      _.forEach(missingTagNames, missingTagName => collectorInfo.push({
        _id: missingTagName,
        lastHourly: 0,
        lastDaily: 0,
        lastMonthly: 0
      }));

      setImmediate(this.next());
    },
    function aggregateMissingDataStep()
    {
      _.forEach(collectorInfo, tagInfo => aggregateMissingTagData(tagInfo, this.parallel()));
    },
    function scheduleNextAggregationStep(err)
    {
      if (err)
      {
        module.error(`Failed to aggregate data: ${err.message}`);
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
    const options = {unique: true, dropDups: true};

    levelCollection.ensureIndex({tag: 1, time: 1}, options, function(err)
    {
      if (err)
      {
        module.error(`Failed to ensure indexes for collection [${levelCollection.name}]: ${err.message}`);
      }

      done();
    });
  }

  /**
   * @private
   * @returns {Array<string>}
   */
  function getAvgTagNames()
  {
    const tagNames = [];

    _.forEach(tags, function(tag, tagName)
    {
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
   * @param {function(?Error)} done
   */
  function aggregateMissingTagData(tagInfo, done)
  {
    const steps = [];

    const currentHourly = resetDate(new Date(), false, false);
    const lastHourly = resetDate(new Date(tagInfo.lastHourly), false, false);

    if (lastHourly < currentHourly)
    {
      steps.push(_.partial(aggregateHourlyDataStep, tagInfo, currentHourly));
    }

    const currentDaily = resetDate(new Date(), true, false);
    const lastDaily = resetDate(new Date(tagInfo.lastDaily), true, false);

    if (lastDaily < currentDaily)
    {
      steps.push(_.partial(aggregateDailyDataStep, tagInfo, currentDaily));
    }

    const currentMonthly = resetDate(new Date(), true, true);
    const lastMonthly = resetDate(new Date(tagInfo.lastMonthly), true, true);

    if (lastMonthly < currentMonthly)
    {
      steps.push(_.partial(aggregateMonthlyDataStep, tagInfo, currentMonthly));
    }

    steps.push(done);

    step(steps);
  }

  /**
   * @private
   * @param {TagInfo} tagInfo
   * @param {Date} currentMonthly
   * @param {?Error} err
   * @returns {undefined}
   */
  function aggregateMonthlyDataStep(tagInfo, currentMonthly, err)
  {
    if (err)
    {
      return this.skip(err);
    }

    const options = {
      from: tagInfo.lastMonthly,
      to: currentMonthly.getTime(),
      tag: tagInfo._id,
      srcCollectionName: 'tags.avg.daily',
      dstCollectionName: 'tags.avg.monthly',
      dstTimeProperty: 'lastMonthly',
      timeDiff: 31 * 24 * 3600 * 1000,
      interval: 'monthly',
      resetDate: _.partialRight(resetDate, true, true)
    };

    aggregateAndSaveData(options, this.next());
  }

  /**
   * @private
   * @param {TagInfo} tagInfo
   * @param {Date} currentDaily
   * @param {?Error} err
   * @returns {undefined}
   */
  function aggregateDailyDataStep(tagInfo, currentDaily, err)
  {
    if (err)
    {
      return this.skip(err);
    }

    const options = {
      from: tagInfo.lastDaily,
      to: currentDaily.getTime(),
      tag: tagInfo._id,
      srcCollectionName: 'tags.avg.hourly',
      dstCollectionName: 'tags.avg.daily',
      dstTimeProperty: 'lastDaily',
      timeDiff: 24 * 3600 * 1000,
      interval: 'daily',
      resetDate: _.partialRight(resetDate, true, false)
    };

    aggregateAndSaveData(options, this.next());
  }

  /**
   * @private
   * @param {TagInfo} tagInfo
   * @param {Date} currentHourly
   * @param {?Error} err
   * @returns {undefined}
   */
  function aggregateHourlyDataStep(tagInfo, currentHourly, err)
  {
    if (err)
    {
      return this.skip(err);
    }

    currentHourly = currentHourly.getTime();

    step(
      function findMinuteDataStep(err)
      {
        if (err)
        {
          return this.skip(err);
        }

        const next = this.next();
        const averagedSrcDocs = [];
        const conditions = {
          _id: {
            $gte: ObjectID.createFromTime(Math.floor(tagInfo.lastHourly / 1000)),
            $lt: ObjectID.createFromTime(Math.floor(currentHourly / 1000))
          }
        };
        const fields = {
          _id: 1,
          c: 1,
          s: 1,
          v: 1,
          n: 1,
          x: 1
        };

        collection(`tags.${tagInfo._id}.avg`).find(conditions).project(fields).sort({_id: 1}).forEach(
          function(minuteData)
          {
            averagedSrcDocs.push({
              tag: tagInfo._id,
              time: minuteData._id.getTimestamp().getTime(),
              count: minuteData.c,
              sum: minuteData.s,
              min: minuteData.n,
              max: minuteData.x,
              avg: minuteData.v,
              dMin: minuteData.dn,
              dMax: minuteData.dx,
              dAvg: minuteData.dv
            });
          },
          function(err)
          {
            next(err, averagedSrcDocs);
          }
        );
      },
      function groupDocsStep(err, averagedSrcDocs)
      {
        if (err)
        {
          return this.skip(err);
        }

        const resetHourlyDate = _.partialRight(resetDate, false, false);
        const groupedDocs = groupDocs(averagedSrcDocs, resetHourlyDate);

        setImmediate(this.next(), null, groupedDocs);
      },
      function averageGroupedDocsStep(err, groupedDocs)
      {
        if (err)
        {
          return this.skip(err);
        }

        const averagedDstDocs = averageGroupedDocs(groupedDocs, tagInfo._id);

        setImmediate(this.next(), null, averagedDstDocs);
      },
      function calculateDeltasStep(err, averagedDstDocs)
      {
        if (err)
        {
          return this.skip(err);
        }

        calculateDeltas(
          tagInfo._id,
          !tagInfo.lastHourly,
          3600 * 1000,
          'hourly',
          averagedDstDocs,
          this.next()
        );
      },
      function saveAveragedDocsStep(err, averagedDstDocs)
      {
        if (err)
        {
          return this.skip(err);
        }

        saveAveragedDocs('tags.avg.hourly', 'lastHourly', currentHourly, averagedDstDocs, this.next());
      },
      this.next()
    );
  }

  /**
   * @private
   * @param {string} tagName
   * @param {boolean} fromTheBeginning
   * @param {number} timeDiff
   * @param {string} interval
   * @param {Array<AveragedDoc>} averagedDocs
   * @param {function(?Error, Array<AveragedDoc>)} done
   */
  function calculateDeltas(tagName, fromTheBeginning, timeDiff, interval, averagedDocs, done)
  {
    step(
      function()
      {
        if (fromTheBeginning)
        {
          collection(`tags.${tagName}.avg`)
            .find({v: {$ne: null}})
            .sort({_id: 1})
            .limit(1)
            .toArray(this.next());
        }
      },
      function(err, firstMinuteData)
      {
        if (err)
        {
          return this.skip(err);
        }

        if (firstMinuteData && firstMinuteData.length)
        {
          const minuteData = firstMinuteData[0];

          this.firstAveragedDoc = {
            min: minuteData.n,
            max: minuteData.x,
            avg: minuteData.v
          };
        }
      },
      function()
      {
        for (let i = 0; i < averagedDocs.length; ++i)
        {
          calculateDelta(
            tagName,
            timeDiff,
            interval,
            averagedDocs[i - 1] || this.firstAveragedDoc,
            averagedDocs[i],
            this.group()
          );
        }
      },
      function(err)
      {
        done(err, averagedDocs);
      }
    );
  }

  /**
   * @private
   * @param {string} tagName
   * @param {number} timeDiff
   * @param {string} interval
   * @param {?AveragedDoc} prevDoc
   * @param {AveragedDoc} doc
   * @param {function(?Error)} done
   * @returns {undefined}
   */
  function calculateDelta(tagName, timeDiff, interval, prevDoc, doc, done)
  {
    if (prevDoc && (!prevDoc.time || (doc.time - prevDoc.time) <= timeDiff))
    {
      if (doc.min !== null && prevDoc.min !== null)
      {
        doc.dMin = round(doc.min - prevDoc.min);
      }

      if (doc.max !== null && prevDoc.max !== null)
      {
        doc.dMax = round(doc.max - prevDoc.max);
      }

      if (doc.avg !== null && prevDoc.avg !== null)
      {
        doc.dAvg = round(doc.avg - prevDoc.avg);
      }

      return done();
    }

    const conditions = {
      tag: tagName,
      time: {
        $gte: doc.time - timeDiff,
        $lt: doc.time
      }
    };
    const sort = {
      tag: -1,
      time: -1
    };

    collection(`tags.avg.${interval}`).find(conditions).sort(sort).limit(1).toArray(function(err, prevDoc)
    {
      if (err)
      {
        return done(err);
      }

      if (!prevDoc.length)
      {
        return done();
      }

      return calculateDelta(tagName, timeDiff, interval, prevDoc[0], doc, done);
    });
  }

  /**
   * @private
   * @param {AggregateDataOptions} options
   * @param {function(?Error)} done
   */
  function aggregateAndSaveData(options, done)
  {
    step(
      function()
      {
        const selector = {
          tag: options.tag,
          time: {
            $gte: options.from,
            $lt: options.to
          }
        };

        collection(options.srcCollectionName)
          .find(selector)
          .sort({tag: 1, time: 1})
          .toArray(this.next());
      },
      function(err, averagedSrcDocs)
      {
        if (err)
        {
          return this.skip(err);
        }

        if (averagedSrcDocs.length === 0)
        {
          return this.skip();
        }

        const groupedDocs = groupDocs(averagedSrcDocs, options.resetDate);

        setImmediate(this.next(), null, groupedDocs);
      },
      function(err, groupedDocs)
      {
        if (err)
        {
          return this.skip(err);
        }

        const averagedDstDocs = averageGroupedDocs(groupedDocs, options.tag);

        setImmediate(this.next(), null, averagedDstDocs);
      },
      function(err, averagedDstDocs)
      {
        if (err)
        {
          return this.skip(err);
        }

        calculateDeltas(
          options.tag,
          !options.from,
          options.timeDiff,
          options.interval,
          averagedDstDocs,
          this.next()
        );
      },
      function(err, averagedDstDocs)
      {
        if (err)
        {
          return this.skip(err);
        }

        saveAveragedDocs(
          options.dstCollectionName,
          options.dstTimeProperty,
          options.to,
          averagedDstDocs,
          this.next()
        );
      },
      done
    );
  }

  /**
   * @param {Array<AveragedDoc>} docs
   * @param {function(Date): Date} resetDate
   * @returns {Array<GroupedDocs>}
   */
  function groupDocs(docs, resetDate)
  {
    const results = [];
    let lastTime = 0;

    _.forEach(docs, function(doc)
    {
      const time = resetDate(new Date(doc.time)).getTime();

      if (time > lastTime)
      {
        lastTime = time;

        results.push({
          time: lastTime,
          docs: []
        });
      }

      results[results.length - 1].docs.push(doc);
    });

    return results;
  }

  /**
   * @private
   * @param {Array<GroupedDocs>} groupedDocs
   * @param {string} tagName
   * @returns {Array<AveragedDoc>}
   */
  function averageGroupedDocs(groupedDocs, tagName)
  {
    return _.map(groupedDocs, function(group)
    {
      const result = {
        tag: tagName,
        time: group.time,
        min: +Infinity,
        max: -Infinity,
        avg: null,
        dMin: null,
        dMax: null,
        dAvg: null
      };
      let sum = 0;
      let cnt = 0;

      for (let i = 0, l = group.docs.length; i < l; ++i)
      {
        const doc = group.docs[i];

        if (doc.min < result.min)
        {
          result.min = doc.min;
        }

        if (doc.max > result.max)
        {
          result.max = doc.max;
        }

        if (doc.avg !== null)
        {
          sum += doc.avg;
          cnt += 1;
        }
      }

      result.avg = cnt === 0 ? null : round(sum / cnt);

      if (!isFinite(result.min))
      {
        result.min = null;
      }

      if (!isFinite(result.max))
      {
        result.max = null;
      }

      return result;
    });
  }

  /**
   * @private
   * @param {string} collectionName
   * @param {string} timeProperty
   * @param {number} newTime
   * @param {Array<AveragedDoc>} averagedDocs
   * @param {function(?Error)} done
   * @returns {undefined}
   */
  function saveAveragedDocs(collectionName, timeProperty, newTime, averagedDocs, done)
  {
    if (!averagedDocs.length)
    {
      return done();
    }

    collection(collectionName).insertMany(averagedDocs, {w: 'majority', j: true, ordered: false}, function(err)
    {
      if (err && err.code !== 11000)
      {
        return done(err);
      }

      const tagName = averagedDocs[averagedDocs.length - 1].tag;
      const tagInfo = _.find(collectorInfo, {_id: tagName});
      const oldTime = tagInfo[timeProperty];

      tagInfo[timeProperty] = newTime;

      collection('collectorInfo').replaceOne({_id: tagInfo._id}, tagInfo, {upsert: true}, function(err)
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
    const nextAggregationTime = +resetDate(new Date(), false, false) + 3660 * 1000;
    const nextAggregationDelay = nextAggregationTime - Date.now();
    const steps = [];

    _.forEach(collectorInfo, function(tagInfo)
    {
      steps.push(function(err)
      {
        if (err)
        {
          module.error(`Failed to aggregate data: ${err.message}`);
        }

        aggregateMissingTagData(tagInfo, this.next());
      });
    });

    steps.push(function(err)
    {
      if (err)
      {
        module.error(`Failed to aggregate data: ${err.message}`);
      }
    });

    steps.push(scheduleNextAggregation);

    setTimeout(_.partial(step, steps), nextAggregationDelay);
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
   * @typedef {Object} TagInfo
   * @property {string} _id
   * @property {number} lastHourly
   * @property {number} lastDaily
   * @property {number} lastMonthly
   */

  /**
   * @typedef {Object} AveragedDoc
   * @property {string} tag
   * @property {number} time
   * @property {number} min
   * @property {number} max
   * @property {number} avg
   * @property {number} dMin
   * @property {number} dMax
   * @property {number} dAvg
   */

  /**
   * @typedef {Object} GroupedDocs
   * @property {number} time
   * @property {Array<AveragedDoc>} docs
   */

  /**
   * @typedef {Object} AggregateDataOptions
   * @property {number} from
   * @property {number} to
   * @property {string} tag
   * @property {string} srcCollectionName
   * @property {string} dstCollectionName
   * @property {string} dstTimeProperty
   * @property {number} timeDiff
   * @property {string} interval
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
