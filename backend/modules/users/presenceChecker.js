// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const _ = require('lodash');
const step = require('h5.step');

module.exports = function setUpPresenceChecker(app, module)
{
  if (!module.config.tediousConnection)
  {
    return;
  }

  const MAX_ROWS = 100;

  let tedious = null;

  try
  {
    tedious = require('tedious');
  }
  catch (err)
  {
    return;
  }

  app.broker.subscribe('app.started', () => schedulePresenceCheck(1000)).setLimit(1);

  function schedulePresenceCheck(delay)
  {
    setTimeout(checkPresence, delay);
  }

  function checkPresence()
  {
    step(
      function()
      {
        app[module.config.settingsId].findValues({_id: /^users\.presence\./}, 'users.presence.', this.next());
      },
      function(err, settings)
      {
        if (err)
        {
          return this.skip(err);
        }

        this.lastRecord = settings.lastRecord || 13106914;
        this.hardware = {};

        String(settings.hardware).split('\n').forEach(line =>
        {
          const matches = line.match(/([0-9]+):([12])/);

          if (matches)
          {
            this.hardware[matches[1]] = +matches[2];
          }
        });

        if (_.isEmpty(this.hardware))
        {
          return this.skip();
        }
      },
      function()
      {
        this.conn = new tedious.Connection(module.config.tediousConnection);

        this.conn.on('error', err => module.error('[presence] %s', err.message));
        this.conn.on('connect', this.next());
      },
      function(err)
      {
        if (err)
        {
          return this.skip(err);
        }

        const sql = `
          SELECT TOP ${MAX_ROWS + 1} PLR_ID, PLR_CARD_ID, PLR_DATE, PLR_INOUT, PLR_HARDWARE_ID
          FROM PL_REGISTRATIONS
          WHERE PLR_ID > ${this.lastRecord}
            AND PLR_HARDWARE_ID IN(${Object.keys(this.hardware)})
          ORDER BY PLR_ID ASC
        `;
        const req = new tedious.Request(sql, this.next());
        const rows = this.rows = [];

        req.on('row', function(columns)
        {
          const row = {};

          columns.forEach(function(column)
          {
            if (column.metadata)
            {
              row[column.metadata.colName] = column.value;
            }
          });

          rows.push(row);
        });

        this.conn.execSql(req);
      },
      function(err)
      {
        if (err)
        {
          return this.skip(err);
        }

        if (this.rows.length === 0)
        {
          return this.skip();
        }

        this.more = this.rows.length === MAX_ROWS + 1;

        if (this.more)
        {
          this.rows.pop();
        }

        const presence = this.presence = {};

        this.rows.forEach(row =>
        {
          presence[row.PLR_CARD_ID] = {
            in: this.hardware[row.PLR_HARDWARE_ID] === row.PLR_INOUT,
            at: row.PLR_DATE
          };
        });
      },
      function()
      {
        const User = app[module.config.mongooseId].model('User');
        const conditions = {
          card: {$in: Object.keys(this.presence)}
        };
        const fields = {
          card: 1,
          presence: 1,
          presenceAt: 1
        };

        User.find(conditions, fields).lean().exec(this.next());
      },
      function(err, users)
      {
        if (err)
        {
          return this.skip(err);
        }

        const User = app[module.config.mongooseId].model('User');

        this.changes = {};

        users.forEach(user =>
        {
          const presence = this.presence[user.card];

          if (presence.in === user.presence || presence.at < user.presenceAt)
          {
            return;
          }

          this.changes[user._id] = presence.in;

          User.collection.update(
            {_id: user._id},
            {$set: {
              presence: presence.in,
              presenceAt: presence.at
            }},
            this.group()
          );
        });
      },
      function(err)
      {
        if (err)
        {
          return this.skip(err);
        }

        app[module.config.settingsId].update(
          'users.presence.lastRecord',
          _.last(this.rows).PLR_ID,
          null,
          this.next()
        );
      },
      function(err)
      {
        if (this.conn)
        {
          this.conn.close();
          this.conn = null;
        }

        if (err)
        {
          module.error(`[presence] Failed to check: ${err.message}`);

          schedulePresenceCheck(30000);
        }
        else
        {
          if (!_.isEmpty(this.changes))
          {
            app.broker.publish('users.presence.updated', this.changes);
          }

          schedulePresenceCheck(this.more ? 500 : 5000);
        }
      }
    );
  }
};
