// Part of <https://miracle.systems/p/walkner-furmon> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const moment = require('moment');
const ObjectID = require('mongodb').ObjectID;
const averageFunctions = require('./averageFunctions');
const setUpAggregator = require('./aggregator');
const setUpCleaner = require('./cleaner');
const round = require('./round');

exports.DEFAULT_CONFIG = {
  modbusId: 'modbus',
  collection: function(app, name)
  {
    return app.mongodb.db.collection(name);
  },
  aggregate: []
};

exports.start = function(app, module)
{
  module.config.collection = module.config.collection.bind(null, app);

  let allDataSaveTimer = null;
  let avgDataSaveTimer = null;
  let allData = [];
  let avgData = {}; // eslint-disable-line prefer-const

  app.onModuleReady(module.config.modbusId, function()
  {
    app.broker.subscribe('tagValueChanged.**', handleTagValueChange);

    setUpAggregator(app, module);
    setUpCleaner(app, module);
    scheduleAvgDataSave();
  });

  module.config.collection('tags.all').ensureIndex(
    {n: 1, t: -1}, {background: true}, function(err)
    {
      if (err)
      {
        module.error(`Failed to ensure index for tags.all: ${err.message}`);
      }
    }
  );

  /**
   * @private
   * @param {Object} message
   */
  function handleTagValueChange(message)
  {
    var tag = message.tag;

    switch (tag.archive)
    {
      case 'all':
        handleAllTag(tag, message);
        break;

      case 'avg':
        handleAvgTag(tag, message);
        break;
    }
  }

  /**
   * @private
   * @param {Tag} tag
   * @param {Object} data
   */
  function handleAllTag(tag, data)
  {
    allData.push({
      t: data.time,
      n: tag.name,
      v: data.newValue
    });

    scheduleSaveAllData();
  }

  /**
   * @private
   */
  function scheduleSaveAllData()
  {
    if (allDataSaveTimer === null && allData.length > 0)
    {
      allDataSaveTimer = setTimeout(saveAllData.bind(null, allData), 1000);
      allData = [];
    }
  }

  /**
   * @private
   * @param {Array<Object>} allDataToSave
   */
  function saveAllData(allDataToSave)
  {
    allDataSaveTimer = null;

    module.config.collection('tags.all').insert(allDataToSave, function(err)
    {
      if (!err)
      {
        if (allData.length > 0)
        {
          scheduleSaveAllData();
        }

        return;
      }

      app.broker.publish('collector.saveFailed', {
        severity: 'debug',
        message: err.message,
        code: err.code
      });
    });
  }

  /**
   * @private
   * @param {Tag} tag
   * @param {Object} data
   */
  function handleAvgTag(tag, data)
  {
    if (!_.isObject(avgData[tag.name]))
    {
      avgData[tag.name] = {
        lastMinuteData: createEmptyLastMinuteData(),
        values: []
      };
    }

    avgData[tag.name].values.push(new Date(data.time), data.newValue);
  }

  /**
   * @private
   * @returns {AveragedDoc}
   */
  function createEmptyLastMinuteData()
  {
    return {
      min: null,
      max: null,
      avg: null,
      dMin: null,
      dMax: null,
      dAvg: null
    };
  }

  /**
   * @private
   */
  function scheduleAvgDataSave()
  {
    if (avgDataSaveTimer === null)
    {
      const now = Date.now();

      avgDataSaveTimer = setTimeout(
        saveAvgData,
        moment(now).startOf('minute').add(1, 'minute').valueOf() - now + 333
      );
    }
  }

  /**
   * @private
   */
  function saveAvgData()
  {
    avgDataSaveTimer = null;

    const tagValues = app[module.config.modbusId].values;
    const saveData = [];

    _.forEach(avgData, function(tagAvgData, tagName)
    {
      const currentValue = tagValues[tagName];

      tagAvgData.values.push(new Date(), currentValue);

      const minuteData = averageFunctions.calculateMinuteData(
        tagAvgData.values,
        tagAvgData.lastMinuteData,
        averageFunctions.arithmeticMean
      );

      if (minuteData.length === 0)
      {
        tagAvgData.lastMinuteData = createEmptyLastMinuteData();

        return;
      }

      tagAvgData.lastMinuteData = _.last(minuteData);

      saveData.push({
        tagName: tagName,
        collection: module.config.collection('tags.' + tagName + '.avg'),
        minuteData: minuteData
      });
    });

    _.forEach(saveData, function(tagSaveData)
    {
      setTimeout(
        saveTagAvgData,
        _.random(10, 10 + 10 * saveData.length),
        tagSaveData.tagName, tagSaveData.collection, tagSaveData.minuteData
      );
    });

    scheduleAvgDataSave();
  }

  /**
   * @private
   * @param {string} tagName
   * @param {Collection} collection
   * @param {Array<Object>} minuteData
   */
  function saveTagAvgData(tagName, collection, minuteData)
  {
    const documents = _.map(minuteData, function(data)
    {
      return {
        _id: new ObjectID(data.time / 1000),
        c: data.count,
        s: data.sum,
        n: round(data.min),
        x: round(data.max),
        v: round(data.avg),
        dn: round(data.dMin),
        dx: round(data.dMax),
        dv: round(data.dAvg)
      };
    });

    collection.insert(documents, function(err)
    {
      if (err)
      {
        app.broker.publish('collector.saveFailed', {
          severity: 'debug',
          message: err.message,
          code: err.code,
          tagName: tagName
        });
      }
    });
  }
};
