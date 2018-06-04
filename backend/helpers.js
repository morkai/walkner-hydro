// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

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

  const month = date.getMonth() + 1;
  const day = date.getDate();
  let result = date.getFullYear() + '-';

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

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  let result = hours < 10 ? ('0' + hours) : hours;

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

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  let result = date.getFullYear();

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

exports.formatDateUtc = function(date)
{
  if (!date)
  {
    return '';
  }

  if (!(date instanceof Date))
  {
    date = new Date(date);
  }

  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  let result = date.getUTCFullYear() + '-';

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

exports.formatTimeUtc = function(date)
{
  if (!date)
  {
    return '';
  }

  if (!(date instanceof Date))
  {
    date = new Date(date);
  }

  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  let result = hours < 10 ? ('0' + hours) : hours;

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

exports.formatDateTimeUtc = function(date)
{
  if (!date)
  {
    return '';
  }

  if (!(date instanceof Date))
  {
    date = new Date(date);
  }

  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  let result = date.getUTCFullYear();

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

  const error = new Error(message);

  error.code = code;
  error.status = statusCode;

  return error;
};
