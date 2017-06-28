// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'moment-timezone',
  'app/socket'
], function(
  moment,
  socket
) {
  'use strict';

  var OFFSET_STORAGE_KEY = 'TIME:OFFSET';
  var TZ_STORAGE_KEY = 'TIME:ZONE';

  var time = {
    synced: false,
    offset: parseFloat(localStorage.getItem(OFFSET_STORAGE_KEY)) || 0,
    zone: localStorage.getItem(TZ_STORAGE_KEY) || 'Europe/Warsaw',
    appData: window.TIME || 0
  };

  delete window.TIME;

  time.sync = function()
  {
    var startTime = Date.now();

    socket.emit('time', function(serverTime, serverTz)
    {
      time.offset = ((serverTime - startTime) + (serverTime - Date.now())) / 2;
      time.zone = serverTz;
      time.synced = true;

      localStorage.setItem(OFFSET_STORAGE_KEY, time.offset.toString());
      localStorage.setItem(TZ_STORAGE_KEY, time.zone);
    });
  };

  time.getServerMoment = function()
  {
    return moment(Date.now() + time.offset).tz(time.zone);
  };

  time.getMoment = function(date, inputFormat)
  {
    return moment(date, inputFormat).tz(time.zone);
  };

  time.format = function(date, format)
  {
    var dateMoment = time.getMoment(date);

    return dateMoment.isValid() ? dateMoment.format(format) : null;
  };

  time.toTagData = function(date, absolute)
  {
    if (!date)
    {
      return {
        iso: '?',
        long: '?',
        human: '?',
        daysAgo: 0
      };
    }

    var timeMoment = time.getMoment(date);
    var then = timeMoment.valueOf();
    var now = Date.now();

    return {
      iso: timeMoment.toISOString(),
      long: timeMoment.format('LLLL'),
      human: absolute === true ? timeMoment.from(then > now ? then : now) : timeMoment.fromNow(),
      daysAgo: -timeMoment.diff(now, 'days')
    };
  };

  /**
   * @param {string|number} str
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
      s: 1,
      ms: 0.001
    };

    var time = str.trim();
    var seconds = parseInt(time, 10);

    if (/^[0-9]+\.?[0-9]*$/.test(time) === false)
    {
      var re = /([0-9\.]+)\s*(h|ms|m|s)[a-z]*/ig;
      var match;

      seconds = 0;

      while ((match = re.exec(time)))
      {
        seconds += parseFloat(match[1]) * multipliers[match[2].toLowerCase()];
      }
    }

    return seconds;
  };

  /**
   * @param {number} time
   * @param {boolean} [compact]
   * @param {boolean} [ms]
   * @returns {string}
   */
  time.toString = function(time, compact, ms)
  {
    if (typeof time !== 'number' || time <= 0 || isNaN(time))
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
        ? rpad0(Math[ms ? 'floor' : 'round'](seconds), 2)
        : (' ' + Math[ms ? 'floor' : 'round'](seconds) + 's');

      if (ms && seconds % 1 !== 0)
      {
        str += compact
          ? ('.' + rpad0(Math.round(seconds % 1 * 1000), 3))
          : (' ' + (Math.round(seconds % 1 * 1000) + 'ms'));
      }
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

  window.time = time;

  return time;
});
