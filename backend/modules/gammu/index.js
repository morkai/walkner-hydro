// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var spawn = require('child_process').spawn;
var errors = require('./errors');

exports.DEFAULT_CONFIG = {
  gammu: '/usr/bin/gammu',
  gammurc: '/etc/gammurc',
  securityCode: {
    type: 'PIN',
    code: null
  },
  timeout: 15000
};

exports.start = function startGammuModule(app, module)
{
  /**
   * @private
   * @type {number}
   */
  var jobId = 0;

  /**
   * @private
   * @type {Array.<object>}
   */
  var jobs = [];

  /**
   * @private
   * @type {object.<string, function(object, function)>}
   */
  var jobHandlers = {
    sendText: sendText,
    enterSecurityCode: enterSecurityCode
  };

  /**
   * @private
   * @type {boolean}
   */
  var working = false;

  /**
   * @param {string} type
   * @param {number} code
   * @param {function(Error|null)} [done]
   */
  module.enterSecurityCode = function(type, code, done)
  {
    scheduleJob('enterSecurityCode', {type: type, code: String(code)}, done);
  };

  /**
   * @param {string} to
   * @param {string} text
   * @param {function(Error|null)} [done]
   */
  module.sendText = function(to, text, done)
  {
    scheduleJob('sendText', {to: to, text: text}, done);
  };

  if (module.config.securityCode.code)
  {
    module.enterSecurityCode(
      module.config.securityCode.type,
      module.config.securityCode.code,
      function(err)
      {
        if (err)
        {
          module.error("Failed to enter security code: %s", err.message);
        }
      }
    );
  }

  /**
   * @private
   * @param {string} type
   * @param {object} options
   * @param {function(Error|null)} [done]
   */
  function scheduleJob(type, options, done)
  {
    jobs.push({
      id: ++jobId,
      type: type,
      options: options,
      done: function(err)
      {
        if (typeof done === 'function')
        {
          done(err);
        }

        working = false;

        process.nextTick(runNextJob);
      }
    });

    module.debug(
      "[%s] Scheduled job #%d (%d total)", type, jobId, jobs.length
    );

    if (!working)
    {
      process.nextTick(runNextJob);
    }
  }

  /**
   * @private
   */
  function runNextJob()
  {
    /*jshint -W015*/

    if (jobs.length === 0 || working)
    {
      return;
    }

    working = true;

    var job = jobs.shift();

    module.debug(
      "[%s] Running job #%d (%d left)...", job.type, job.id, jobs.length
    );

    var handler = jobHandlers[job.type];

    if (typeof handler === 'function')
    {
      handler(job.options, job.done);
    }
  }

  /**
   * @private
   * @param {object} options
   * @param {function(Error|null)} done
   */
  function sendText(options, done)
  {
    var to = options.to.replace(/[^0-9]/g, '');

    if (to.length === 9)
    {
      to = '48' + to;
    }

    if (to.length !== 11)
    {
      return done(new Error('INVALID_MOBILE_NUMBER'));
    }

    to = '+' + to;

    var eol;
    var eot;

    if (process.platform === 'win32')
    {
      eol = '\r\n';
      eot = '\u001a';
    }
    else
    {
      eol = '\n';
      eot = '\u0004';
    }

    var gammu = spawnGammu(['sendsms', 'TEXT', to], done);

    gammu.stdin.write(
      options.text.replace(/(\r\n|\r|\n)/g, eol).trim(),
      'utf8'
    );

    gammu.stdin.end();
  }

  /**
   * @private
   * @param {object} options
   * @param {function(Error|null)} done
   */
  function enterSecurityCode(options, done)
  {
    spawnGammu(['entersecuritycode', options.type, options.code], done);
  }

  /**
   * @private
   * @param {Array.<string>} args
   * @param {function} [done]
   * @returns {ChildProcess}
   */
  function spawnGammu(args, done)
  {
    var gammu = spawn(
      module.config.gammu,
      ['-c', module.config.gammurc].concat(args)
    );
    var timeout = false;
    var timer = app.timeout(module.config.timeout, function()
    {
      timeout = true;
      gammu.kill();
    });

    gammu.on('exit', function(code)
    {
      clearTimeout(timer);

      gammu.removeAllListeners();

      if (done)
      {
        if (timeout)
        {
          done('TIMEOUT');
        }
        else
        {
          done(code ? errors.fromExitCode(code) : null);
        }
      }
    });

    gammu.on('error', function(err)
    {
      gammu.removeAllListeners();

      if (done)
      {
        done(err);
      }
    });

    return gammu;
  }
};
