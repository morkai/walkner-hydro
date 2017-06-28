// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

exports.formatDate = function(date)
{
  if (!date)
  {
    return '';
  }

  if (!(date instanceof Date))
  {
    date = new Date(date);
  }

  var result = date.getFullYear() + '-';
  var month = date.getMonth() + 1;
  var day = date.getDate();

  if (month < 10)
  {
    result += '0' + month;
  }
  else
  {
    result += month;
  }

  if (day < 10)
  {
    result += '-0' + day;
  }
  else
  {
    result += '-' + day;
  }

  return result;
};

exports.formatTime = function(date)
{
  if (!date)
  {
    return '';
  }

  if (!(date instanceof Date))
  {
    date = new Date(date);
  }

  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();
  var result = hours < 10 ? ('0' + hours) : hours;

  if (minutes < 10)
  {
    result += ':0' + minutes;
  }
  else
  {
    result += ':' + minutes;
  }

  if (seconds < 10)
  {
    result += ':0' + seconds;
  }
  else
  {
    result += ':' + seconds;
  }

  return result;
};

exports.formatDateTime = function(date)
{
  if (!date)
  {
    return '';
  }

  if (!(date instanceof Date))
  {
    date = new Date(date);
  }

  var result = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();

  if (month < 10)
  {
    result += '-0' + month;
  }
  else
  {
    result += '-' + month;
  }

  if (day < 10)
  {
    result += '-0' + day;
  }
  else
  {
    result += '-' + day;
  }

  if (hours < 10)
  {
    result += ' 0' + hours;
  }
  else
  {
    result += ' ' + hours;
  }

  if (minutes < 10)
  {
    result += ':0' + minutes;
  }
  else
  {
    result += ':' + minutes;
  }

  if (seconds < 10)
  {
    result += ':0' + seconds;
  }
  else
  {
    result += ':' + seconds;
  }

  return result;
};

exports.createError = function(message, code, statusCode)
{
  if (typeof code === 'number')
  {
    statusCode = code;
    code = undefined;
  }

  var error = new Error(message);

  error.code = code;
  error.status = statusCode;

  return error;
};
