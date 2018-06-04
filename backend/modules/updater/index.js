// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const fs = require('fs');
const _ = require('lodash');
const setUpRoutes = require('./routes');
const setUpCommands = require('./commands');
const expressMiddleware = require('./expressMiddleware');

exports.DEFAULT_CONFIG = {
  expressId: 'express',
  sioId: 'sio',
  packageJsonPath: 'package.json',
  versionsKey: 'wmes',
  backendVersionKey: 'backend',
  frontendVersionKey: 'frontend',
  manifestPath: null,
  restartDelay: 15000,
  errorTemplate: 'error503',
  pull: {
    exe: 'git',
    cwd: process.cwd(),
    timeout: 60000
  },
  manifests: [],
  captureSigint: true
};

exports.start = function startUpdaterModule(app, module)
{
  let reloadTimer = null;
  let restartTimer = null;

  module.config.packageJsonPath = require.resolve(module.config.packageJsonPath);

  module.package = reloadPackageJson();

  module.restarting = 0;

  module.manifest = module.config.manifestPath ? fs.readFileSync(module.config.manifestPath, 'utf8') : null;

  module.config.manifests.forEach(manifest => _.defaults(manifest, {
    frontendVersionKey: module.config.frontendVersionKey,
    template: module.manifest
  }));

  module.getManifest = function(requiredFrontendVersionKey)
  {
    return module.config.manifests.find(manifest =>
    {
      const actualFrontendVersionKey = manifest.frontendVersionKey || module.config.frontendVersionKey;

      return actualFrontendVersionKey === requiredFrontendVersionKey;
    });
  };

  module.getVersions = clone =>
  {
    if (!module.package.updater)
    {
      module.package.updater = {};
    }

    const updater = module.package.updater;
    const versionsKey = module.config.versionsKey;

    if (!updater[versionsKey])
    {
      updater[versionsKey] = {};
      updater[versionsKey][module.config.backendVersionKey] = -1;
      updater[versionsKey][module.config.frontendVersionKey] = -1;
    }

    updater[versionsKey].package = module.package.version;

    return clone === false ? updater[versionsKey] : _.cloneDeep(updater[versionsKey]);
  };

  module.getBackendVersion = backendVersionKey =>
  {
    return module.getVersions(false)[backendVersionKey || module.config.backendVersionKey];
  };

  module.getFrontendVersion = frontendVersionKey =>
  {
    return module.getVersions(false)[frontendVersionKey || module.config.frontendVersionKey];
  };

  module.updateFrontendVersion = frontendVersionKey =>
  {
    const versions = module.getVersions(false);

    if (typeof versions[frontendVersionKey] === 'undefined')
    {
      frontendVersionKey = module.config.frontendVersionKey;
    }

    versions[frontendVersionKey] = Date.now();
  };

  app.broker.subscribe('express.beforeMiddleware').setLimit(1).on('message', message =>
  {
    const expressModule = message.module;
    const expressApp = expressModule.app;

    expressApp.use(expressMiddleware.bind(null, app, module));
  });

  app.onModuleReady(module.config.expressId, setUpRoutes.bind(null, app, module));

  app.onModuleReady(module.config.sioId, setUpCommands.bind(null, app, module));

  fs.watch(module.config.packageJsonPath, () =>
  {
    if (reloadTimer !== null)
    {
      clearTimeout(reloadTimer);
    }

    reloadTimer = setTimeout(compareVersions, 1000);
  });

  if (module.config.captureSigint)
  {
    process.on('SIGINT', handleSigint);
  }

  function reloadPackageJson()
  {
    delete require.cache[module.config.packageJsonPath];

    module.package = require(module.config.packageJsonPath);

    return module.package;
  }

  function compareVersions()
  {
    reloadTimer = null;

    const oldVersions = module.getVersions(true);
    const oldBackendVersion = module.getBackendVersion();
    const oldFrontendVersion = module.getFrontendVersion();

    reloadPackageJson();

    const newVersions = module.getVersions(false);
    const newBackendVersion = module.getBackendVersion();
    const newFrontendVersion = module.getFrontendVersion();

    if (newBackendVersion !== oldBackendVersion)
    {
      module.info(
        'Backend version changed from [%s] to [%s]...',
        oldBackendVersion,
        newBackendVersion
      );

      handleBackendUpdate(oldBackendVersion, newBackendVersion);
    }
    else if (newFrontendVersion !== oldFrontendVersion)
    {
      module.info(
        'Frontend version changed from [%s] to [%s]...',
        oldFrontendVersion,
        newFrontendVersion
      );

      handleFrontendUpdate(oldFrontendVersion, newFrontendVersion);
    }

    _.forEach(newVersions, (newVersion, service) =>
    {
      const oldVersion = oldVersions[service] || 0;

      if (newVersion !== oldVersion)
      {
        app.broker.publish('updater.newVersion', {
          service: service,
          oldVersion: oldVersion,
          newVersion: newVersion
        });
      }
    });
  }

  function handleBackendUpdate(oldBackendVersion, newBackendVersion)
  {
    if (restartTimer !== null)
    {
      return false;
    }

    module.restarting = Date.now();

    module.info('Restarting in %d seconds...', module.config.restartDelay / 1000);

    restartTimer = setTimeout(shutdown, module.config.restartDelay);

    app.broker.publish('updater.newVersion', {
      service: 'backend',
      oldVersion: oldBackendVersion,
      newVersion: newBackendVersion,
      delay: module.config.restartDelay
    });

    app.broker.publish('updater.restarting');

    return true;
  }

  function handleFrontendUpdate(oldFrontendVersion, newFrontendVersion)
  {
    app.broker.publish('updater.newVersion', {
      service: 'frontend',
      oldVersion: oldFrontendVersion,
      newVersion: newFrontendVersion
    });
  }

  function handleSigint()
  {
    const backendVersion = module.getBackendVersion();

    if (!handleBackendUpdate(backendVersion, backendVersion))
    {
      module.info('Forcing shutdown...');

      shutdown();
    }
  }

  function shutdown()
  {
    module.info('Exiting the process...');

    setImmediate(process.exit.bind(process));
  }
};
