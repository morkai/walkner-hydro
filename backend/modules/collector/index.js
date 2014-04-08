// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var lodash = require('lodash');
var ObjectID = require('mongodb').ObjectID;
var averageFunctions = require('./averageFunctions');
var setUpAggregator = require('./aggregator');
var setUpCleaner = require('./cleaner');

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

  var allDataSaveTimer = null;
  var avgDataSaveTimer = null;
  var allData = [];
  var avgData = {};

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
        module.error("Failed to ensure index for tags.all: %s", err.message);
      }
    }
  );

  /**
   * @private
   * @param {object} message
   */
  function handleTagValueChange(message)
  {
    /*jshint -W015*/

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
   * @param {object} data
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
   * @param {Array.<object>} allDataToSave
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
   * @param {object} data
   */
  function handleAvgTag(tag, data)
  {
    if (!lodash.isObject(avgData[tag.name]))
    {
      avgData[tag.name] = {
        lastValue: 0,
        values: []
      };
    }

    avgData[tag.name].values.push(new Date(data.time), data.newValue);
  }

  /**
   * @private
   */
  function scheduleAvgDataSave()
  {
    if (avgDataSaveTimer === null)
    {
      avgDataSaveTimer = setTimeout(saveAvgData, 60000);
    }
  }

  /**
   * @private
   */
  function saveAvgData()
  {
    avgDataSaveTimer = null;

    var avgTags = Object.keys(avgData);
    var saveData = [];

    avgTags.forEach(function(tagName)
    {
      var tagAvgData = avgData[tagName];
      var currentValue = app[module.config.modbusId].values[tagName];

      tagAvgData.values.push(new Date(), currentValue);

      var minuteData = averageFunctions.calculateMinuteData(
        tagAvgData.values,
        tagAvgData.lastValue,
        averageFunctions.arithmeticMean
      );

      tagAvgData.lastValue = currentValue;

      if (minuteData.length === 0)
      {
        return;
      }

      saveData.push({
        collection: module.config.collection('tags.' + tagName + '.avg'),
        minuteData: minuteData
      });
    });

    saveData.forEach(function(tagSaveData)
    {
      setTimeout(
        saveTagAvgData.bind(
          null, tagSaveData.collection, tagSaveData.minuteData
        ),
        lodash.random(10, 10 + 10 * saveData.length)
      );
    });

    scheduleAvgDataSave();
  }

  /**
   * @private
   * @param {Collection} collection
   * @param {Array.<object>} minuteData
   */
  function saveTagAvgData(collection, minuteData)
  {
    var documents = minuteData.map(function(data)
    {
      return {
        _id: new ObjectID(data.time / 1000),
        n: round(data.min),
        x: round(data.max),
        v: round(data.avg)
      };
    });

    collection.insert(documents, function(err)
    {
      if (err)
      {
        app.broker.publish('collector.saveFailed', {
          severity: 'debug',
          message: err.message,
          code: err.code
        });
      }
    });
  }

  /**
   * @private
   * @param number
   * @returns {number}
   */
  function round(number)
  {
    return Math.round(number * 10000) / 10000;
  }
};
