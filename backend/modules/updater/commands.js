// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const exec = require('child_process').exec;

module.exports = function setUpUpdaterCommands(app, updaterModule)
{
  const sio = app[updaterModule.config.sioId];

  sio.sockets.on('connection', function(socket)
  {
    socket.emit('updater.versions', updaterModule.getVersions());

    socket.on('updater.pull', function(reply)
    {
      if (typeof reply !== 'function')
      {
        reply = function() {};
      }

      const user = socket.handshake.user;

      if (!user || !user.super)
      {
        updaterModule.warn('Unauthorized pull attempt from:', JSON.stringify(socket.handshake));

        return reply(new Error('AUTH'));
      }

      const cmd = '"' + updaterModule.config.pull.exe + '" pull';

      updaterModule.debug('Attempting a pull...');

      exec(cmd, updaterModule.config.pull, function(err, stdout, stderr)
      {
        if (err)
        {
          updaterModule.error('Failed the pull: %s', err.stack);
        }
        else if (stderr && stderr.length)
        {
          updaterModule.debug('Failed the pull :(');
        }
        else
        {
          updaterModule.debug('Pull succeeded :)');
        }

        reply(err, {stdout: stdout, stderr: stderr});
      });
    });
  });
};
