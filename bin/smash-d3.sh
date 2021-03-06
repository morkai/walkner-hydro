#!/bin/sh

BASEDIR=`dirname "$0"`
D3=$BASEDIR/../node_modules/d3/src

$BASEDIR/../node_modules/.bin/smash \
  $D3/start.js \
  $D3/time/format.js \
  $D3/time/scale.js \
  $D3/selection/selection.js \
  $D3/svg/axis.js \
  $D3/event/mouse.js \
  $D3/end.js \
  > $BASEDIR/../frontend/vendor/d3/smashed.js
