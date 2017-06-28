// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var exec = require('child_process').exec;

module.exports = function setUpUpdaterCommands(app, updaterModule)
{
  var sio = app[updaterModule.config.sioId];

  sio.sockets.on('connection', function(socket)
  {
    socket.emit('updater.versions', updaterModule.getVersions());

    socket.on('updater.pull', function(reply)
    {
      if (typeof reply !== 'function')
      {
        reply = function() {};
      }

      var user = socket.handshake.user;

      if (!user || !user.super)
      {
        updaterModule.warn("Unauthorized pull attempt from:", JSON.stringify(socket.handshake));

        return reply(new Error('AUTH'));
      }

      var cmd = '"' + updaterModule.config.pull.exe + '" pull';

      updaterModule.debug("Attempting a pull...");

      exec(cmd, updaterModule.config.pull, function(err, stdout, stderr)
      {
        if (err)
        {
          updaterModule.error("Failed the pull: %s", err.stack);
        }
        else if (stderr && stderr.length)
        {
          updaterModule.debug("Failed the pull :(");
        }
        else
        {
          updaterModule.debug("Pull succeeded :)");
        }

        reply(err, {stdout: stdout, stderr: stderr});
      });
    });
  });
};
