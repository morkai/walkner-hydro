// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const exec = require('child_process').exec;

module.exports = function(options, done)
{
  const cmd = '"' + options.gitExe + '" pull';

  exec(cmd, {cwd: options.cwd, timeout: 30000}, function(err, stdout, stderr)
  {
    done(err, {stdout: stdout, stderr: stderr});
  });
};
