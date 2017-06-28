// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var exec = require('child_process').exec;

module.exports = function(options, done)
{
  var cmd = '"' + options.gitExe + '" pull';

  exec(cmd, {cwd: options.cwd, timeout: 30000}, function(err, stdout, stderr)
  {
    done(err, {stdout: stdout, stderr: stderr});
  });
};
