// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

/* eslint-disable no-process-env, no-process-exit */

'use strict';

var startTime = Date.now();

if (!process.env.NODE_ENV)
{
  process.env.NODE_ENV = 'development';
}

require('./extensions');

var requireCache = require('./requireCache');
var _ = require('lodash');
var moment = require('moment');
var main = require('h5.main');
var blocked = function() {};

try
{
  if (process.env.NODE_ENV === 'development')
  {
    blocked = require('blocked');
  }
}
catch (err) {} // eslint-disable-line no-empty

var config = require(process.argv[2]);

moment.locale('pl');

var modules = (config.modules || []).map(function(module)
{
  if (typeof module === 'string')
  {
    module = {id: module};
  }

  if (typeof module !== 'object' || module === null)
  {
    console.error("Invalid module:", module);
    process.exit(1);
  }

  if (typeof module.id !== 'string')
  {
    console.error("Module ID is required:", module);
    process.exit(1);
  }

  if (typeof module.name !== 'string')
  {
    module.name = module.id;
  }

  if (typeof module.path !== 'string')
  {
    module.path = './modules/' + module.id;
  }

  module.config = config[module.name];

  return module;
});

var app = {
  options: _.assign({}, config, {
    id: config.id,
    startTime: startTime,
    env: process.env.NODE_ENV,
    rootPath: __dirname,
    moduleStartTimeout: config.moduleStartTimeout || 3000
  })
};

_.assign(app, require('./helpers'));

blocked(function(ms)
{
  app.debug("Event loop blocked for %sms :(", ms);
});

main(app, modules);

app.broker.subscribe('app.started').setLimit(1).on('message', function()
{
  if (requireCache.built)
  {
    requireCache.save();
  }
});
