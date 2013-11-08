'use strict';

var startTime = Date.now();

require('./extensions');

var main = require('h5.main');
var config = require(process.argv[2]);

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
  options: {
    id: config.id,
    startTime: startTime,
    env: process.env.NODE_ENV,
    rootPath: __dirname,
    moduleStartTimeout: 3000
  }
};

main(app, modules);
