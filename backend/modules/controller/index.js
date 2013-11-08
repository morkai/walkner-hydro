'use strict';

var lodash = require('lodash');
var setUpControllerRoutes = require('./routes');

exports.DEFAULT_CONFIG = {
  messengerClientId: 'messenger/client',
  pubsubId: 'pubsub',
  sioId: 'sio',
  mongooseId: 'mongoose',
  userId: 'user',
  expressId: 'express'
};

exports.start = function startControllerModule(app, module)
{
  var messengerClient = app[module.config.messengerClientId];
  var pubsub = app[module.config.pubsubId] || null;

  if (!messengerClient)
  {
    throw new Error("controller module requires the messenger/client module!");
  }

  module.values = {};
  module.tags = [];

  app.onModuleReady(module.config.sioId, setUpClientMessages);
  app.onModuleReady(
    [
      module.config.mongooseId,
      module.config.userId,
      module.config.expressId
    ],
    setUpControllerRoutes.bind(null, app, module)
  );

  setUpServerMessages();

  if (messengerClient.isConnected())
  {
    process.nextTick(sync);
  }

  app.broker
    .subscribe('messenger.client.connected', sync)
    .setFilter(function(message)
    {
      return message.socketType === 'req'
        && message.moduleName === module.config.messengerClientId;
    });

  /**
   * @private
   */
  function sync()
  {
    messengerClient.request('modbus.sync', null, function(err, res)
    {
      if (!lodash.isObject(res))
      {
        return;
      }

      if (res.tags)
      {
        module.info("Synced tag definitions.");

        handleTagsChangedMessage(res.tags);
      }

      if (res.values)
      {
        module.info("Synced tag values.");

        handleTagValuesChangedMessage(res.values);
      }
    });
  }

  /**
   * @private
   */
  function setUpClientMessages()
  {
    app[module.config.sioId].sockets.on('connection', function(socket)
    {
      socket.on(
        'controller.setTagValue', handleSetTagValueMessage.bind(null, socket)
      );

      socket.on(
        'controller.readVfdParam',
        handleReadVfdParamMessage.bind(null, socket)
      );

      socket.on(
        'controller.compareVfdParams',
        handleCompareVfdParamsMessage.bind(null, socket)
      );

      socket.on(
        'controller.writeVfdParam',
        handleWriteVfdParamMessage.bind(null, socket)
      );
    });
  }

  /**
   * @private
   */
  function setUpServerMessages()
  {
    app.broker.subscribe(
      'modbus.tagsChanged', handleTagsChangedMessage
    );

    app.broker.subscribe(
      'modbus.tagValuesChanged', handleTagValuesChangedMessage
    );

    app.broker.subscribe(
      'vfd.paramDiff', handleVfdParamDiffMessage
    );

    app.broker.subscribe(
      'vfd.comparingParams', handleComparingVfdParamsMessage
    );
  }

  /**
   * @private
   * @param {object.<string, object>} tags
   */
  function handleTagsChangedMessage(tags)
  {
    if (!lodash.isObject(tags))
    {
      return;
    }

    module.tags = tags;

    app.broker.publish('controller.tagsChanged', lodash.values(tags));
  }

  /**
   * @private
   * @param {object.<string, number|null>} values
   */
  function handleTagValuesChangedMessage(values)
  {
    if (!lodash.isObject(values))
    {
      return;
    }

    lodash.forEach(values, function(tagValue, tagName)
    {
      module.values[tagName] = tagValue;
    });

    app.broker.publish('controller.tagValuesChanged', values);
  }

  /**
   * @private
   * @param {object} paramDiffInfo
   */
  function handleVfdParamDiffMessage(paramDiffInfo)
  {
    if (lodash.isObject(paramDiffInfo) && pubsub !== null)
    {
      pubsub.publish('controller.vfdParamDiff', paramDiffInfo);
    }
  }

  /**
   * @private
   * @param {boolean} state
   */
  function handleComparingVfdParamsMessage(state)
  {
    if (lodash.isBoolean(state) && pubsub !== null)
    {
      pubsub.publish('controller.comparingVfdParams', state);
    }
  }

  /**
   * @private
   * @param {object} socket
   * @param {string} tagName
   * @param {string|number} tagValue
   * @param {function} reply
   */
  function handleSetTagValueMessage(socket, tagName, tagValue, reply)
  {
    if (!lodash.isFunction(reply))
    {
      reply = function() {};
    }

    var user = socket.handshake.user;

    if (!lodash.isObject(user)
      || !Array.isArray(user.privileges)
      || user.privileges.indexOf('SETTINGS_MANAGE') === -1)
    {
      return reply({
        message: "Not allowed.",
        code: 'TAG_WRITE_NO_PERM'
      });
    }

    if (!lodash.isString(tagName))
    {
      return reply({
        message: "Tag name must be a string.",
        code: 'TAG_WRITE_INVALID_NAME'
      });
    }
    else if (!lodash.isString(tagValue)
      && !lodash.isNumber(tagValue)
      && !lodash.isBoolean(tagValue))
    {
      return reply({
        message: "Tag value must be a string, a number or a boolean.",
        code: 'TAG_WRITE_INVALID_VALUE'
      });
    }

    var tag = module.tags[tagName];

    if (!tag)
    {
      return reply({
        message: "Unknown tag.",
        code: 'TAG_WRITE_UNKNOWN'
      });
    }

    if (!tag.writable)
    {
      return reply({
        message: "Tag's not writable.",
        code: 'TAG_WRITE_NOT_WRITABLE'
      });
    }

    var oldValue = module.values[tagName];

    messengerClient.request(
      'modbus.setTagValue',
      {name: tagName, value: tagValue},
      function(err)
      {
        reply(err);

        if (err)
        {
          module.error(
            "Failed to set tag %s to %s: %s", tagName, tagValue, err.message
          );
        }
        else
        {
          module.info("Tag %s was set to %s", tagName, tagValue);

          var topic = 'controller.'
            + (tag.kind === 'setting' ? 'settingChanged' : 'tagValueSet');

          app.broker.publish(topic, {
            severity: 'debug',
            user: user,
            tag: tagName,
            newValue: tagValue,
            oldValue: oldValue
          });
        }
      }
    );
  }

  /**
   * @private
   * @param {object} socket
   */
  function canManageSettings(socket)
  {
    var user = socket.handshake.user;

    return lodash.isObject(user)
      && Array.isArray(user.privileges)
      && user.privileges.indexOf('SETTINGS_MANAGE') !== -1;
  }

  /**
   * @private
   * @param {object} socket
   * @param {object} req
   * @param {function} reply
   */
  function handleReadVfdParamMessage(socket, req, reply)
  {
    if (!lodash.isFunction(reply))
    {
      reply = function() {};
    }

    if (canManageSettings(socket))
    {
      return reply({
        message: "Not allowed.",
        code: 'VFD_NO_PERM'
      });
    }

    module.request('vfd.readParam', req || {}, reply);
  }

  /**
   * @private
   * @param {object} socket
   * @param {object} req
   * @param {function} reply
   */
  function handleCompareVfdParamsMessage(socket, req, reply)
  {
    if (!lodash.isFunction(reply))
    {
      reply = function() {};
    }

    if (canManageSettings(socket))
    {
      return reply({
        message: "Not allowed.",
        code: 'VFD_NO_PERM'
      });
    }

    module.request('vfd.compareParams', req || {}, reply);
  }

  /**
   * @private
   * @param {object} socket
   * @param {object} req
   * @param {function} reply
   */
  function handleWriteVfdParamMessage(socket, req, reply)
  {
    if (!lodash.isFunction(reply))
    {
      reply = function() {};
    }

    if (canManageSettings(socket))
    {
      return reply({
        message: "Not allowed.",
        code: 'VFD_NO_PERM'
      });
    }

    module.request('vfd.writeParam', req || {}, reply);
  }
};
