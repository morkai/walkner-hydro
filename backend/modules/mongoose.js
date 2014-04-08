// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var lodash = require('lodash');
var mongoose = require('mongoose');

exports.DEFAULT_CONFIG = {
  maxConnectTries: 10,
  connectAttemptDelay: 500,
  uri: 'mongodb://localhost/walkner-hydro',
  options: {}
};

exports.start = function startDbModule(app, module, done)
{
  module = app[module.name] = lodash.merge(mongoose, module);

  tryToConnect(0);

  /**
   * @private
   * @param {number} i
   */
  function tryToConnect(i)
  {
    module.connect(module.config.uri, module.config.options, function(err)
    {
      if (err)
      {
        if (i === module.config.maxConnectTries)
        {
          return done(err);
        }

        return setTimeout(
          function() { tryToConnect(i + 1); },
          module.config.connectAttemptDelay
        );
      }

      loadModels();
    });
  }

  /**
   * @private
   */
  function loadModels()
  {
    var modelsDir = app.pathTo('models');
    var modelsList = require(app.pathTo('models', 'index'));

    app.loadFiles(modelsDir, modelsList, [app, module], done);
  }
};
