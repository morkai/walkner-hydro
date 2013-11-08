'use strict';

exports.id = 'frontend';

exports.modules = [
  'health/endpoint',
  'mongoose',
  'events',
  'httpServer',
  'httpsServer',
  'sio',
  'pubsub',
  {id: 'messenger/client', name: 'messenger/client:controller'},
  {id: 'messenger/client', name: 'messenger/client:alarms'},
  'controller',
  'user',
  'express',
  'breakin/frontend',
  'alarms/frontend',
  'users/frontend'
];

exports.events = {
  collection: function(app) { return app.mongoose.model('Event').collection; },
  insertDelay: 1000,
  topics: {
    debug: [
      'app.started',
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
  key: __dirname + '/privatekey.pem',
  cert: __dirname + '/certificate.pem'
};

exports.pubsub = {
  statsPublishInterval: 1000,
  republishTopics: [
    'events.saved',
    'users.added', 'users.edited', 'users.deleted',
    'alarms.**',
    'controller.tagsChanged', 'controller.tagValuesChanged'
  ]
};

exports.mongoose = {
  maxConnectTries: 10,
  connectAttemptDelay: 500,
  uri: require('./mongodb').uri,
  options: {}
};

exports.express = {
  staticPath: __dirname + '/../frontend',
  staticBuildPath: __dirname + '/../frontend-build',
  sessionCookieKey: 'hydro.sid',
  cookieSecret: '1ee7hydra',
  ejsAmdHelpers: {
    t: 'app/i18n'
  }
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
