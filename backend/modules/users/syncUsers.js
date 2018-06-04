// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const bcrypt = require('bcrypt');
const transliterate = require('transliteration').transliterate;
const step = require('h5.step');

module.exports = function syncUsers(app, usersModule, done)
{
  let tedious;

  try
  {
    tedious = require('tedious');
  }
  catch (err)
  {
    return done(new Error('MODULE'));
  }

  if (!usersModule.config.tediousConnection)
  {
    return done(new Error('MODULE'));
  }

  const companies = app[usersModule.config.companiesId];
  const mongoose = app[usersModule.config.mongooseId];
  const User = mongoose.model('User');

  const conn = new tedious.Connection(usersModule.config.tediousConnection);

  conn.on('error', function(err)
  {
    usersModule.error('[tedious] %s', err.message);
  });

  conn.on('connect', function(err)
  {
    if (err)
    {
      return done(err);
    }

    queryUsers(conn);
  });

  function createSelectUsersSql()
  {
    const sql = `
      SELECT
        [USERS].[US_ID],
        [CARDS].[CA_NUMBER],
        [USERS].[US_NAME],
        [USERS].[US_SURNAME],
        [USERS].[US_PERSONELLID],
        [USERS].[US_ADD_FIELDS],
        [USERS].[US_ACTIVE]
      FROM [USERS]
      LEFT JOIN [CARDS] ON [USERS].[US_CARD_ID]=[CARDS].[CA_ID]
    `;
    const where = [];

    _.forEach(companies.models, function(companyModel)
    {
      const companyId = companyModel._id.replace(/'/g, "\\'");

      where.push("[USERS].[US_ADD_FIELDS] LIKE '10001&" + companyId + "&%'");
    });

    return sql + ' WHERE [USERS].[US_ACTIVE]=1 AND (' + where.join(' OR ') + ') ORDER BY [USERS].[US_ID]';
  }

  function queryUsers(conn)
  {
    const stats = {
      created: 0,
      updated: 0,
      errors: 0
    };
    const kdUsers = [];

    const req = new tedious.Request(createSelectUsersSql(), function(err)
    {
      conn.close();

      if (err)
      {
        done(err);
      }
      else
      {
        setImmediate(syncNextUser, stats, kdUsers, 0);
      }
    });

    req.on('row', function(row)
    {
      const addFields = parseAddFields(row[5].value);

      kdUsers.push({
        kdId: +row[0].value,
        card: _.isString(row[1].value) && !_.isEmpty(row[1].value) ? row[1].value.toString() : null,
        firstName: row[2].value,
        lastName: row[3].value,
        personellId: row[4].value,
        active: row[6].value === 1,
        company: addFields['10001'] || null,
        kdDivision: addFields['10003'] || null,
        kdPosition: addFields['10004'] || null
      });
    });

    conn.execSql(req);
  }

  function syncNextUser(stats, kdUsers, kdUserIndex)
  {
    if (kdUserIndex === kdUsers.length)
    {
      return setImmediate(done, null, stats);
    }

    const kdUser = kdUsers[kdUserIndex];

    step(
      function findUserModelStep()
      {
        if (!kdUser.personellId)
        {
          return this.skip();
        }

        User.findOne({kdId: kdUser.kdId}, this.parallel());
        User.findOne({login: String(kdUser.personellId)}, this.parallel());
      },
      function prepareUserModelStep(err, kdIdUser, loginUser)
      {
        if (err)
        {
          usersModule.error('Failed to find a user by KD ID [%s]: %s', kdUser.kdId, err.message);

          ++stats.errors;

          return this.skip();
        }

        let user = loginUser || kdIdUser;

        this.isNew = false;

        if (user)
        {
          user.set(kdUser);
        }
        else
        {
          this.isNew = true;

          kdUser.login = kdUser.personellId;
          kdUser.password = ']:->';
          kdUser.email = generateEmailAddress(usersModule.config.emailGenerator, kdUser);

          user = new User(kdUser);
        }

        if (!user.gender)
        {
          user.gender = /a$/i.test(user.firstName) ? 'female' : 'male';
        }

        this.userModel = user;
      },
      function hashPasswordStep()
      {
        if (this.isNew)
        {
          bcrypt.hash(this.userModel.login, 10, this.next());
        }
      },
      function setPasswordHashStep(err, hash)
      {
        if (err)
        {
          usersModule.warn(`[sync] Failed to hash password: ${err.message}`);
        }

        if (hash)
        {
          this.userModel.password = hash;
        }
      },
      function saveUserModelStep()
      {
        saveUserModel(this.userModel, this.isNew, false, stats, this.next());
      },
      function finalizeStep()
      {
        this.userModel = null;

        setImmediate(syncNextUser, stats, kdUsers, kdUserIndex + 1);
      }
    );
  }

  function saveUserModel(userModel, isNew, isRetry, stats, done)
  {
    const modified = userModel.modifiedPaths();

    if (!modified.length || (modified.length === 1 && modified[0] === 'kdId'))
    {
      return done();
    }

    userModel.save(function(err)
    {
      if (err)
      {
        let error = err.message;

        if (err.name === 'ValidationError')
        {
          error += ':\n' + _.map(err.errors, function(e) { return e.toString(); }).join('\n');
        }

        usersModule.error('Failed to save a user with KD ID [%s]: %s', userModel.kdId, error);

        if (err.code === 11000 && !isRetry)
        {
          return updateOldUserModel(userModel, stats, done);
        }

        ++stats.errors;
      }
      else if (isNew)
      {
        ++stats.created;

        usersModule.debug(`[sync] Created: ${userModel.login}: ${userModel.firstName} ${userModel.lastName}`);
      }
      else
      {
        ++stats.updated;
      }

      return done();
    });
  }

  function updateOldUserModel(newUserModel, stats, done)
  {
    User.findOne({login: newUserModel.login}).exec(function(err, oldUserModel)
    {
      if (err || !oldUserModel)
      {
        return done();
      }

      oldUserModel.set({
        card: newUserModel.card,
        firstName: newUserModel.firstName,
        lastName: newUserModel.lastName,
        personellId: newUserModel.personellId,
        active: newUserModel.active,
        company: newUserModel.company,
        kdDivision: newUserModel.kdDivision,
        kdPosition: newUserModel.kdPosition
      });

      setImmediate(saveUserModel, oldUserModel, false, true, stats, done);
    });
  }
};

function parseAddFields(addFields)
{
  if (!_.isString(addFields) || _.isEmpty(addFields))
  {
    return {};
  }

  const addFieldList = addFields.split('&');
  const addFieldMap = {};

  for (let i = 0, l = addFieldList.length; i < l; i += 2)
  {
    const key = addFieldList[i].trim();

    if (key == null || key === '')
    {
      continue;
    }

    addFieldMap[key] = addFieldList[i + 1].trim();
  }

  return addFieldMap;
}

function generateEmailAddress(generator, kdUser)
{
  return !generator ? '' : generator({
    firstName: transliterate(kdUser.firstName || '', {unknown: '?'}).toLowerCase(),
    lastName: transliterate(kdUser.lastName || '', {unknown: '?'}).toLowerCase(),
    personnelId: kdUser.personnelId || '',
    company: (kdUser.company || '').toUpperCase()
  });
}
