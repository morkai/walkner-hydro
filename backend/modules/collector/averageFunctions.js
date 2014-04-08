// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

module.exports = {
  calculateMinuteData: calculateMinuteData,
  arithmeticMean: arithmeticMean
};

/**
 * @param {Array.<number>} input
 * @param {number} currentValue
 * @param {function(number, Array.<number|Array.<number>>): object} aggregate
 * @returns {Array.<object>}
 */
function calculateMinuteData(input, currentValue, aggregate)
{
  var results = [];

  if (input.length === 0 || input.length % 2 !== 0)
  {
    return results;
  }

  var newestEntryTime = Date.now();
  var fromTime = resetMinute(input[0]);
  var toTime = fromTime + 59999;

  if (toTime >= newestEntryTime)
  {
    return results;
  }

  var minuteData = [];
  var i;
  var l;
  var ii;

  for (i = 0, l = input.length; i < l; i += 2)
  {
    var entryDate = input[i];

    if (entryDate > toTime)
    {
      if (Array.isArray(currentValue))
      {
        currentValue = aggregate(-1, currentValue).avg;
      }

      if (minuteData.length < 60)
      {
        for (ii = minuteData.length; ii < 60; ++ii)
        {
          minuteData.push(currentValue);
        }
      }

      results.push(aggregate(fromTime, minuteData));

      var newFromTime = resetMinute(entryDate);
      var minutesWithoutChange = Math.floor((newFromTime - toTime) / 60000);

      for (ii = 0; ii < minutesWithoutChange; ++ii)
      {
        results.push({
          time: (toTime + 1000) + ii * 60000,
          count: 60,
          sum: currentValue * 60,
          max: currentValue,
          min: currentValue,
          avg: currentValue
        });
      }

      fromTime = newFromTime;
      toTime = fromTime + 59999;
      minuteData = [];
      i -= 2;

      if (toTime > newestEntryTime)
      {
        break;
      }

      continue;
    }

    var entryValue = input[i + 1];
    var entrySeconds = entryDate.getUTCSeconds();
    var lastValueIndex = minuteData.length - 1;

    if (entrySeconds === lastValueIndex)
    {
      if (!Array.isArray(minuteData[lastValueIndex]))
      {
        currentValue = [minuteData[lastValueIndex]];
        minuteData[lastValueIndex] = currentValue;
      }

      minuteData[lastValueIndex].push(entryValue);
    }
    else
    {
      if (Array.isArray(currentValue))
      {
        currentValue = aggregate(-1, currentValue).avg;
      }

      for (ii = minuteData.length; ii < entrySeconds; ++ii)
      {
        minuteData.push(currentValue);
      }

      currentValue = entryValue;

      minuteData.push(currentValue);
    }
  }

  if (minuteData.length === 60)
  {
    results.push(aggregate(fromTime, minuteData));
  }

  i += 2;

  input.splice(0, i);

  return results;
}

/**
 * @param {number} fromTime
 * @param {Array.<number|Array.<number>>} minuteData
 * @returns {object}
 */
function arithmeticMean(fromTime, minuteData)
{
  var result = {
    time: fromTime,
    count: minuteData.length,
    sum: 0,
    max: -Infinity,
    min: +Infinity,
    avg: 0
  };

  for (var i = 0, l = result.count; i < l; ++i)
  {
    var value = minuteData[i];

    if (Array.isArray(value))
    {
      var secondSum = 0;

      for (var ii = 0, ll = value.length; ii < ll; ++ii)
      {
        secondSum += value[ii];
      }

      value = secondSum / value.length;
    }

    result.sum += value;

    if (value > result.max)
    {
      result.max = value;
    }

    if (value < result.min)
    {
      result.min = value;
    }
  }

  result.avg = result.sum / result.count;

  return result;
}

/**
 * @private
 * @param {Date} date
 * @returns {number}
 */
function resetMinute(date)
{
  date = new Date(date.getTime());

  date.setUTCSeconds(0);
  date.setUTCMilliseconds(0);

  return date.getTime();
}
