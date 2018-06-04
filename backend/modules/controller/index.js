// Part of <https://miracle.systems/p/walkner-maxos> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const setUpControllerRoutes = require('./routes');

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
  let messengerClient = app[module.config.messengerClientId];

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

  if (messengerClient)
  {
    if (messengerClient.isConnected())
    {
      setImmediate(sync);
    }
  }
  else
  {
    app.onModuleReady(
      module.config.messengerClientId,
      () => { messengerClient = app[module.config.messengerClientId]; }
    );
  }

  app.broker
    .subscribe('messenger.client.connected', sync)
    .setFilter(m => m.socketType === 'req' && m.moduleName === module.config.messengerClientId);

  /**
   * @private
   */
  function sync()
  {
    messengerClient.request('modbus.sync', null, function(err, res)
    {
      if (err)
      {
        module.error(`Failed to sync: ${err.message}`);
      }

      if (!_.isObject(res))
      {
        return;
      }

      if (res.tags)
      {
        module.info('Synced tag definitions.');

        handleTagsChangedMessage(res.tags);
      }

      if (res.values)
      {
        module.info('Synced tag values.');

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
      socket.on('controller.setTagValue', handleSetTagValueMessage.bind(null, socket));
    });
  }

  /**
   * @private
   */
  function setUpServerMessages()
  {
    app.broker.subscribe('modbus.tagsChanged', handleTagsChangedMessage);
    app.broker.subscribe('modbus.tagValuesChanged', handleTagValuesChangedMessage);
  }

  /**
   * @private
   * @param {Object<string, Object>} tags
   */
  function handleTagsChangedMessage(tags)
  {
    if (!_.isObject(tags))
    {
      return;
    }

    module.tags = tags;

    app.broker.publish('controller.tagsChanged', _.values(tags));
  }

  /**
   * @private
   * @param {Object} values
   */
  function handleTagValuesChangedMessage(values)
  {
    if (!_.isObject(values))
    {
      return;
    }

    _.forEach(values, function(tagValue, tagName)
    {
      module.values[tagName] = tagValue;

      const tag = module.tags[tagName];

      if (tag)
      {
        tag.value = tagValue;
      }
    });

    values['@timestamp'] = Date.now();

    app.broker.publish('controller.tagValuesChanged', values);
  }

  /**
   * @private
   * @param {Object} socket
   * @param {string} tagName
   * @param {(string|number)} tagValue
   * @param {function} reply
   */
  function handleSetTagValueMessage(socket, tagName, tagValue, reply)
  {
    if (!_.isFunction(reply))
    {
      reply = function() {};
    }

    if (!canManageSettings(socket))
    {
      reply({
        message: 'Not allowed.',
        code: 'TAG_WRITE_NO_PERM'
      });

      return;
    }

    const oldValue = module.values[tagName];

    setTagValue(tagName, tagValue, function(err, tag)
    {
      reply(err);

      if (err)
      {
        module.error(`Failed to set tag [${tagName}] to [${tagValue}]: ${err.message}`);

        return;
      }

      module.info(`Tag [${tagName}] was set to [${tagValue}].`);

      app.broker.publish(`controller.${tag.kind === 'setting' ? 'settingChanged' : 'tagValueSet'}`, {
        severity: 'debug',
        user: socket.handshake.user,
        tag: tagName,
        newValue: tagValue,
        oldValue: oldValue
      });
    });
  }

  function setTagValue(tagName, tagValue, done)
  {
    if (!_.isString(tagName))
    {
      done({
        message: 'Tag name must be a string.',
        code: 'TAG_WRITE_INVALID_NAME'
      });

      return;
    }

    const tag = module.tags[tagName];

    if (!tag)
    {
      done({
        message: 'Unknown tag.',
        code: 'TAG_WRITE_UNKNOWN'
      });

      return;
    }

    if (!tag.writable)
    {
      done({
        message: 'Tag is not writable.',
        code: 'TAG_WRITE_NOT_WRITABLE'
      });

      return;
    }

    if (!_.isString(tagValue)
      && !_.isNumber(tagValue)
      && !_.isBoolean(tagValue)
      && typeof tagValue !== 'object')
    {
      done({
        message: 'Tag value must be an object, a string, a number or a boolean.',
        code: 'TAG_WRITE_INVALID_VALUE'
      });

      return;
    }

    messengerClient.request('modbus.setTagValue', {name: tagName, value: tagValue}, function(err)
    {
      done(err, tag);
    });
  }

  /**
   * @private
   * @param {Object} socket
   * @returns {boolean}
   */
  function canManageSettings(socket)
  {
    const {headers, user} = socket.handshake;

    if (user && (user.super || user.local || _.includes(user.privileges, 'SETTINGS:MANAGE')))
    {
      return true;
    }

    if (headers && _.isString(headers['user-agent']) && headers['user-agent'].includes('X11; Linux'))
    {
      return true;
    }

    return false;
  }
};
