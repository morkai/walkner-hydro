'use strict';

const mongodb = require('./mongodb');

exports.id = 'frontend';

exports.modules = [
  'health/endpoint',
  'updater',
  'mongoose',
  'events',
  'pubsub',
  'user',
  'express',
  'users',
  {id: 'messenger/client', name: 'messenger/client:controller'},
  {id: 'messenger/client', name: 'messenger/client:alarms'},
  'controller',
  'breakin/frontend',
  'alarms/frontend',
  'httpServer',
  'sio'
];

exports.mainJsFile = '/main.js';
exports.mainCssFile = '/assets/main.css';
exports.faviconFile = 'assets/favicon.ico';

exports.frontendAppData = {
  TAG_VALUES: function(app)
  {
    return app.controller && app.controller.values
      ? app.controller.values
      : {};
  }
};

exports.events = {
  collection: function(app) { return app.mongoose.model('Event').collection; },
  insertDelay: 1000,
  topics: {
    debug: [
      'users.added', 'users.edited',
      'users.login', 'users.logout',
      'alarms.added', 'alarms.edited',
      'controller.settingChanged'
    ],
    info: [
      'events.**'
    ],
    warning: [
      'users.deleted',
      'users.loginFailure',
      'alarms.deleted',
      'controller.tagValueSet'
    ],
    error: [
      'app.started'
    ]
  }
};

exports.httpServer = {
  host: '0.0.0.0',
  port: 80
};

exports.httpsServer = {
  host: '0.0.0.0',
  port: 443,
  key: __dirname + '/https.key',
  cert: __dirname + '/https.crt'
};

exports.sio = {
  httpServerIds: ['httpServer'],
  socketIo: {
    pingInterval: 10000,
    pingTimeout: 5000
  }
};

exports.pubsub = {
  statsPublishInterval: 180000,
  republishTopics: [
    'events.saved',
    'users.added', 'users.edited', 'users.deleted',
    'alarms.**',
    'controller.tagsChanged', 'controller.tagValuesChanged'
  ]
};

exports.mongoose = {
  uri: mongodb.uri,
  options: Object.assign(mongodb.mongoClient, {
    poolSize: 8
  }),
  maxConnectTries: 10,
  connectAttemptDelay: 500,
  models: [
    'event', 'user', 'alarm', 'passwordResetRequest'
  ]
};

exports.express = {
  staticPath: __dirname + '/../frontend',
  staticBuildPath: __dirname + '/../frontend-build',
  sessionCookieKey: 'hydro.sid',
  sessionCookie: {
    httpOnly: true,
    path: '/',
    maxAge: 3600 * 24 * 30 * 1000
  },
  sessionStore: {
    touchInterval: 10 * 60 * 1000,
    touchChance: 0
  },
  cookieSecret: '|-|y|)r0',
  ejsAmdHelpers: {
    t: 'app/i18n'
  },
  textBody: {limit: '15mb'},
  jsonBody: {limit: '4mb'}
};

exports.user = {
  localAddresses: [/^192\.168\./, /^10\.0\.0\./],
  privileges: [
    'SETTINGS_VIEW',
    'SETTINGS_MANAGE',
    'MONITORING_VIEW',
    'DIAGNOSTICS_VIEW',
    'ANALYTICS_VIEW',
    'EVENTS_VIEW',
    'EVENTS_MANAGE',
    'ALARMS_VIEW',
    'ALARMS_MANAGE',
    'ALARMS_ACK',
    'ALARMS_BREAKIN',
    'USERS_VIEW',
    'USERS_MANAGE'
  ]
};

exports['messenger/client:controller'] = {
  pubHost: '127.0.0.1',
  pubPort: 5050,
  repHost: '127.0.0.1',
  repPort: 5051,
  responseTimeout: 15000
};

exports.controller = {
  messengerClientId: 'messenger/client:controller'
};

exports['messenger/client:alarms'] = {
  pubHost: '127.0.0.1',
  pubPort: 5052,
  repHost: '127.0.0.1',
  repPort: 5053,
  responseTimeout: 5000
};

exports['alarms/frontend'] = {
  messengerClientId: 'messenger/client:alarms'
};

exports['breakin/frontend'] = {
  messengerClientId: 'messenger/client:controller',
  operatorIps: [
    '127.0.0.1',
    '192.168.1.100'
  ],
  stopPassword: '!ee7'
};

exports['health/endpoint'] = {
  messengerClientId: 'messenger/client:controller'
};

exports.updater = {
  // manifestPath: __dirname + '/manifest.appcache',
  packageJsonPath: __dirname + '/../package.json',
  restartDelay: 5000,
  pull: {
    exe: 'git.exe',
    cwd: __dirname + '/../',
    timeout: 30000
  },
  versionsKey: 'hydro',
  manifests: [
    {
      path: '/manifest.appcache',
      mainJsFile: exports.mainJsFile,
      mainCssFile: exports.mainCssFile
    }
  ]
};
