/* eslint-disable quote-props */

'use strict';

exports.paths = {
  'text': 'vendor/require/text',
  'i18n': 'vendor/require/i18n',
  'domReady': 'vendor/require/domReady',
  'underscore': 'vendor/underscore/underscore',
  'jquery': 'vendor/jquery/jquery',
  'jquery.transit': 'vendor/jquery/jquery.transit',
  'jquery.typeahead': 'vendor/jquery/jquery.typeahead',
  'backbone': 'vendor/backbone/backbone',
  'backbone.layout': 'vendor/backbone.layoutmanager/backbone.layoutmanager',
  'moment': 'vendor/moment/moment',
  'moment-lang': 'vendor/moment/lang',
  'moment-timezone': 'vendor/moment/moment-timezone',
  'bootstrap': 'vendor/bootstrap/js/bootstrap',
  'bootstrap-switch': 'vendor/bootstrap-switch/bootstrap-switch',
  'socket.io': 'vendor/socket.io/socket.io',
  'h5.pubsub': 'vendor/h5.pubsub',
  'h5.rql': 'vendor/h5.rql',
  'd3': 'vendor/d3/smashed',
  'cubism': 'vendor/cubism/cubism.v1',
  'form2js': 'vendor/form2js/form2js',
  'js2form': 'vendor/form2js/js2form',
  'flot': 'vendor/flot/jquery.flot',
  'flot.time': 'vendor/flot/jquery.flot.time',
  'flot.crosshair': 'vendor/flot/jquery.flot.crosshair',
  'pathseg': 'vendor/pathseg'
};

exports.shim = {
  'jquery.transit': ['jquery'],
  'jquery.typeahead': ['jquery'],
  'underscore': {
    exports: '_'
  },
  'backbone': {
    deps: ['underscore', 'jquery'],
    exports: 'Backbone'
  },
  'bootstrap': ['jquery'],
  'bootstrap-switch': ['bootstrap'],
  'd3': {
    exports: 'd3'
  },
  'cubism': {
    deps: ['d3'],
    exports: 'cubism'
  },
  'flot': ['jquery'],
  'flot.time': ['flot'],
  'flot.crosshair': ['flot'],
  'pathseg': {
    exports: 'SVGPathSeg'
  }
};

exports.buildPaths = exports.paths;
exports.buildShim = exports.shim;
