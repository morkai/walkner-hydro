// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

define([
  'jquery',
  './socket'
], function(
  $,
  socket
) {
  'use strict';

  var time = {offset: 0};

  time.sync = function()
  {
    var startTime = Date.now();

    socket.emit('time', function(serverTime)
    {
      time.offset = ((serverTime - startTime) + (serverTime - Date.now())) / 2;
    });
  };

  /**
   * @param {string} str
   * @returns {number}
   */
  time.toSeconds = function(str)
  {
    if (typeof str === 'number')
    {
      return str;
    }

    if (typeof str !== 'string')
    {
      return 0;
    }

    var multipliers = {
      g: 3600,
      h: 3600,
      m: 60,
      s: 1
    };

    var time = str.trim();
    var seconds = parseInt(time, 10);

    if (/^[0-9]+\.?[0-9]*$/.test(time) === false)
    {
      var re = /([0-9\.]+) *(h|m|s)[a-z]*/ig;
      var match;

      seconds = 0;

      while ((match = re.exec(time)))
      {
        seconds += match[1] * multipliers[match[2].toLowerCase()];
      }
    }

    return seconds;
  };

  /**
   * @param {number} time
   * @param {boolean} [compact]
   * @returns {string}
   */
  time.toString = function(time, compact)
  {
    if (typeof time !== 'number' || time <= 0)
    {
      return compact ? '00:00:00' : '0s';
    }

    var str = '';
    var hours = Math.floor(time / 3600);

    if (hours > 0)
    {
      str += compact ? (rpad0(hours, 2) + ':') : (' ' + hours + 'h');
      time = time % 3600;
    }
    else if (compact)
    {
      str += '00:';
    }

    var minutes = Math.floor(time / 60);

    if (minutes > 0)
    {
      str += compact ? (rpad0(minutes, 2) + ':') : (' ' + minutes + 'min');
      time = time % 60;
    }
    else if (compact)
    {
      str += '00:';
    }

    var seconds = time;

    if (seconds >= 1)
    {
      str += compact
        ? rpad0(Math.round(seconds), 2)
        : (' ' + Math.round(seconds) + 's');
    }
    else if (seconds > 0 && str === '')
    {
      str += ' ' + (seconds * 1000) + 'ms';
    }
    else if (compact)
    {
      str += '00';
    }

    return compact ? str : str.substr(1);
  };

  function rpad0(val, length)
  {
    val = String(val);

    while (val.length < length)
    {
      val = '0' + val;
    }

    return val;
  }

  socket.on('connect', function()
  {
    time.sync();
  });

  if (socket.isConnected())
  {
    time.sync();
  }

  return time;
});
