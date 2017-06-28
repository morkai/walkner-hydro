'use strict';

const mongodb = require('./mongodb');

exports.id = 'alarms';

exports.modules = [
  'health/endpoint',
  'mongoose',
  'events',
  'messenger/server',
  'mail/sender',
  'gammu',
  {id: 'messenger/client', name: 'messenger/client:controller'},
  'controller',
  'alarms/backend'
];

exports.events = {
  expressId: null,
  collection: function(app) { return app.mongoose.model('Event').collection; },
  insertDelay: 1000,
  topics: {
    debug: [
      'alarms.actionExecuted',
      'alarms.actions.emailSent',
      'alarms.actions.smsSent'
    ],
    info: [
      'events.**',
      'alarms.run',
      'alarms.activated',
      'alarms.deactivated'
    ],
    warning: [
      'alarms.stopped'
    ],
    error: [
      'app.started',
      'alarms.compileFailed',
      'alarms.conditionCheckFailed',
      'alarms.actions.emailFailed',
      'alarms.actions.smsFailed',
      'alarms.actions.findUsersFailed'
    ]
  }
};

exports.mongoose = {
  uri: mongodb.uri,
  options: mongodb,
  maxConnectTries: 10,
  connectAttemptDelay: 500,
  models: [
    'event', 'user', 'alarm'
  ]
};

exports['messenger/server'] = {
  pubHost: '0.0.0.0',
  pubPort: 5052,
  repHost: '0.0.0.0',
  repPort: 5053,
  broadcastTopics: [
    'events.saved',
    'alarms.run',
    'alarms.stopped',
    'alarms.activated',
    'alarms.deactivated',
    'alarms.actionExecuted',
    'alarms.actions.**',
    'alarms.compileFailed',
    'alarms.conditionCheckFailed'
  ]
};

exports['messenger/client:controller'] = {
  pubHost: '127.0.0.1',
  pubPort: 5050,
  repHost: '127.0.0.1',
  repPort: 5051,
  responseTimeout: 5000
};

exports.controller = {
  messengerClientId: 'messenger/client:controller',
  pubsub: null,
  expressId: null
};

exports['mail/sender'] = {
  smtp: {
    service: 'gmail',
    auth: {
      user: 'someone@gmail.com',
      pass: 'P4$$W0RD'
    }
  },
  from: 'someone+hydro@the.net',
  replyTo: 'someone+hydro@the.net'
};

exports.gammu = {
  gammu: '/usr/bin/gammu',
  gammurc: '/etc/gammurc',
  securityCode: {
    type: 'PIN',
    code: null
  }
};

exports['health/endpoint'] = {
  messengerClientId: 'messenger/client:controller'
};
