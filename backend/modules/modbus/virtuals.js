// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

const _ = require('lodash');

module.exports = function setUpVirtualTags(app, modbus)
{
  setUpMasterStatusTag();
  setUpOutputPumpsTags();

  function setUpMasterStatusTag()
  {
    const controlProcessTag = modbus.tags['masters.controlProcess'];

    if (_.isUndefined(controlProcessTag))
    {
      modbus.warn("masters.controlProcess tag is not defined!");

      return;
    }

    const statusTags = [];

    _.each(modbus.config.controlMasters, function(controlMaster)
    {
      const master = modbus.masters[controlMaster];

      if (_.isObject(master))
      {
        statusTags.push('masters.' + controlMaster);
      }
    });

    const doCheckMasterControlStatus = checkControlProcessMastersStatus.bind(
      null, statusTags, controlProcessTag
    );

    _.each(statusTags, function(masterStatusTag)
    {
      app.broker.subscribe('tagValueChanged.' + masterStatusTag, doCheckMasterControlStatus);
    });
  }

  function checkControlProcessMastersStatus(statusTags, controlProcessTag)
  {
    let newState = true;

    for (let i = 0, l = statusTags.length; i < l; ++i)
    {
      if (!modbus.values[statusTags[i]])
      {
        newState = false;

        break;
      }
    }

    controlProcessTag.setValue(newState);
  }

  function setUpOutputPumpsTags()
  {
    app.broker.subscribe('tagValueChanged.outputPumps.*.status.*', checkOutputPumpStatus);
  }

  function checkOutputPumpStatus(message)
  {
    const statusTag = message.tag.name.replace(/\.(vfd|grid)$/, '');
    const vfdStatusTag = statusTag + '.vfd';
    const gridStatusTag = statusTag + '.grid';

    modbus.tags[statusTag].setValue(
      modbus.values[vfdStatusTag] || modbus.values[gridStatusTag]
    );
  }
};
