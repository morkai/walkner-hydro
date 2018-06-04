// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const EventEmitter = require('events').EventEmitter;
const {spawn} = require('child_process');
const _ = require('lodash');
const step = require('h5.step');
const mongoSerializer = require('h5.rql/lib/serializers/mongoSerializer');
const helpers = require('../../helpers');

const CSV_COLUMN_SEPARATOR = ';';
const CSV_ROW_SEPARATOR = '\r\n';
const CSV_FORMATTERS = {
  'string': function(value)
  {
    if (value === null || value === undefined || value === '')
    {
      return '""';
    }

    return '"' + String(value).trim().replace(/"/g, '""').replace(/\s+/g, ' ') + '"';
  },
  'integer': function(value)
  {
    if (value === null || value === undefined || value === '')
    {
      return '';
    }

    return parseInt(value, 10).toString();
  },
  'decimal': function(value)
  {
    if (value === null || value === undefined || value === '')
    {
      return '';
    }

    return parseFloat(Number(value).toFixed(3)).toString().replace('.', ',');
  },
  'percent': function(value)
  {
    if (value === null || value === undefined || value === '')
    {
      return '';
    }

    return parseFloat(Number(value).toFixed(3)).toString().replace('.', ',');
  },
  'datetime': function(value) { return helpers.formatDateTime(value); },
  'date': function(value) { return helpers.formatDate(value); },
  'time': function(value) { return helpers.formatTime(value); },
  'datetime+utc': function(value) { return helpers.formatDateTimeUtc(value); },
  'date+utc': function(value) { return helpers.formatDateUtc(value); },
  'time+utc': function(value) { return helpers.formatTimeUtc(value); },
  'boolean': function(value) { return value ? 1 : 0; }
};
const EXPORT_SHORT_TYPES = {
  '"': 'string',
  '#': 'integer',
  '%': 'percent',
  '$': 'decimal',
  '@': 'datetime',
  '-': 'date',
  ':': 'time',
  '?': 'boolean'
};
const EXPORT_TYPE_WIDTHS = {
  'string': 20,
  'integer': 10,
  'decimal': 10,
  'percent': 7,
  'datetime': 18,
  'date': 10,
  'time': 10,
  'datetime+utc': 18,
  'date+utc': 10,
  'time+utc': 10,
  'boolean': 10
};

exports.browseRoute = function(app, options, req, res, next)
{
  let Model;

  if (options.model && options.model.model)
  {
    Model = options.model;
  }
  else
  {
    Model = options;
    options = {};
  }

  const queryOptions = mongoSerializer.fromQuery(req.rql);

  if (queryOptions.limit === 0)
  {
    queryOptions.limit = typeof Model.BROWSE_LIMIT === 'number' ? Model.BROWSE_LIMIT : 100;
  }

  if (queryOptions.limit > Model.BROWSE_LIMIT && Model.BROWSE_LIMIT > 0)
  {
    queryOptions.limit = Model.BROWSE_LIMIT;
  }

  if (queryOptions.limit === Number.MAX_SAFE_INTEGER)
  {
    queryOptions.limit = 0;
  }

  step(
    function countStep()
    {
      if (_.isNumber(options.totalCount))
      {
        return this.next()(null, options.totalCount);
      }

      Model.count(queryOptions.selector, this.next());
    },
    function findStep(err, totalCount)
    {
      if (err)
      {
        return this.done(next, err);
      }

      this.totalCount = totalCount;

      if (totalCount > 0)
      {
        const query = Model.find(queryOptions.selector, queryOptions.fields, queryOptions).lean();

        try
        {
          populateQuery(query, req.rql);
        }
        catch (err)
        {
          return this.done(next, err);
        }

        query.exec(this.next());
      }
    },
    function sendResponseStep(err, models)
    {
      if (err)
      {
        return this.done(next, err);
      }

      const totalCount = this.totalCount;

      if (!Array.isArray(models))
      {
        models = [];
      }

      if (totalCount > 0 && typeof Model.customizeLeanObject === 'function')
      {
        models = models.map(leanModel => Model.customizeLeanObject(leanModel, queryOptions.fields));
      }

      if (typeof options.prepareResult === 'function')
      {
        options.prepareResult(totalCount, models, formatResult);
      }
      else
      {
        formatResult(null, {
          totalCount: totalCount,
          collection: models
        });
      }
    }
  );

  function formatResult(err, result)
  {
    if (err)
    {
      return next(err);
    }

    res.format({
      json: function()
      {
        res.json(result);
      }
    });
  }
};

exports.addRoute = function(app, Model, req, res, next)
{
  if (req.body.__v)
  {
    delete req.body.__v;
  }

  const model = req.model || new Model(req.body);

  model.save(function(err)
  {
    req.model = null;

    if (err)
    {
      if (err.name === 'ValidationError')
      {
        res.statusCode = 400;
      }
      else if (err.code === 11000)
      {
        res.statusCode = 400;
        err.code = 'DUPLICATE_KEY';

        let matches = err.message.match(/\.\$(.*?) /);

        if (!matches)
        {
          matches = err.message.match(/ (.*?) dup key/);
        }

        err.index = matches ? matches[1] : '';
      }

      return next(err);
    }

    res.format({
      json: function()
      {
        res.status(201).send(model);
      }
    });

    if (Model.CRUD_PUBLISH !== false)
    {
      app.broker.publish((Model.TOPIC_PREFIX || Model.collection.name) + '.added', {
        model: model,
        user: req.session.user
      });
    }
  });
};

exports.readRoute = function(app, options, req, res, next)
{
  let Model;

  if (options.model && options.model.model)
  {
    Model = options.model;
  }
  else
  {
    Model = options;
    options = {};
  }

  if (req.model)
  {
    return handleModel(null, req.model);
  }

  const idProperty = options.idProperty
    ? (typeof options.idProperty === 'function' ? options.idProperty(req) : options.idProperty)
    : '_id';
  const conditions = typeof idProperty === 'string'
    ? {[idProperty]: req.params.id}
    : idProperty;
  const queryOptions = mongoSerializer.fromQuery(req.rql);
  const query = Model.findOne(conditions, queryOptions.fields).lean();

  try
  {
    populateQuery(query, req.rql);
  }
  catch (err)
  {
    return next(err);
  }

  query.exec(handleModel);

  function handleModel(err, model)
  {
    if (err)
    {
      return next(err);
    }

    if (model === null)
    {
      return res.sendStatus(404);
    }

    if (typeof Model.customizeLeanObject === 'function')
    {
      model = Model.customizeLeanObject(model);
    }

    if (typeof options.prepareResult === 'function')
    {
      options.prepareResult(model, formatResult);
    }
    else
    {
      formatResult(null, model);
    }
  }

  function formatResult(err, result)
  {
    if (err)
    {
      return next(err);
    }

    res.format({
      json: function()
      {
        try
        {
          res.send(result);
        }
        catch (err)
        {
          next(err);
        }
      }
    });
  }
};

exports.editRoute = function(app, options, req, res, next)
{
  if (req.body.__v)
  {
    delete req.body.__v;
  }

  let Model;

  if (options.model && options.model.model)
  {
    Model = options.model;
  }
  else
  {
    Model = options;
    options = {};
  }

  if (req.model === null)
  {
    edit(null, null);
  }
  else if (typeof req.model === 'object')
  {
    edit(null, req.model);
  }
  else
  {
    Model.findById(req.params.id, edit);
  }

  function edit(err, model)
  {
    req.model = null;

    if (err)
    {
      return next(err);
    }

    if (model === null)
    {
      return res.sendStatus(404);
    }

    if (typeof options.beforeSet === 'function')
    {
      options.beforeSet(model, req);
    }

    model.set(req.body);

    if (typeof options.beforeSave === 'function')
    {
      options.beforeSave(model, req);
    }

    if (!model.isModified())
    {
      return sendResponse(res, model);
    }

    model.save(function(err)
    {
      if (err)
      {
        if (err.name === 'ValidationError')
        {
          res.statusCode = 400;
        }
        else if (err.code === 11000)
        {
          res.statusCode = 400;
          err.code = 'DUPLICATE_KEY';

          let matches = err.message.match(/\.\$(.*?) /);

          if (!matches)
          {
            matches = err.message.match(/ (.*?) dup key/);
          }

          err.index = matches ? matches[1] : '';
        }

        return next(err);
      }

      sendResponse(res, model);

      if (Model.CRUD_PUBLISH !== false)
      {
        app.broker.publish((Model.TOPIC_PREFIX || Model.collection.name) + '.edited', {
          model: model,
          user: req.session.user
        });
      }

      if (!err && typeof options.afterSave === 'function')
      {
        options.afterSave(model, req);
      }
    });
  }

  function sendResponse(res, model)
  {
    res.format({
      json: function()
      {
        res.send(model);
      }
    });
  }
};

exports.deleteRoute = function(app, Model, req, res, next)
{
  if (req.model === null)
  {
    del(null, null);
  }
  else if (typeof req.model === 'object')
  {
    del(null, req.model);
  }
  else
  {
    Model.findById(req.params.id, del);
  }

  function del(err, model)
  {
    req.model = null;

    if (err)
    {
      return next(err);
    }

    if (model === null)
    {
      return res.sendStatus(404);
    }

    model.remove(function(err)
    {
      if (err)
      {
        return next(err);
      }

      res.format({
        json: function()
        {
          res.sendStatus(204);
        }
      });

      if (Model.CRUD_PUBLISH !== false)
      {
        app.broker.publish((Model.TOPIC_PREFIX || Model.collection.name) + '.deleted', {
          model: model,
          user: req.session.user
        });
      }
    });
  }
};

exports.exportRoute = function(app, options, req, res, next)
{
  app.debug('[express] Exporting: %s', JSON.stringify({
    url: req.url,
    user: app.user.createUserInfo(req.session.user, req)
  }, null, 2));

  const format = req.params.format === 'xlsx' && app.express.config.jsonToXlsxExe ? 'xlsx' : 'csv';
  let cursorClosed = false;
  let headerWritten = false;
  let columns = null;
  let jsonToXlsx = null;
  let rowIndex = 0;

  if (format === 'xlsx')
  {
    initializeXlsx();
  }
  else if (format === 'csv')
  {
    initializeCsv();
  }

  function stream()
  {
    let cursor = options.cursor;

    if (cursor === undefined)
    {
      const queryOptions = mongoSerializer.fromQuery(req.rql);
      const query = options.model
        .find(queryOptions.selector, queryOptions.fields)
        .sort(queryOptions.sort)
        .lean();

      try
      {
        populateQuery(query, req.rql);
      }
      catch (err)
      {
        return next(err);
      }

      cursor = query.cursor({batchSize: options.batchSize || 10});
    }

    if (cursor && cursor.close)
    {
      req.once('aborted', () => cursor.close());
    }

    if (options.serializeStream)
    {
      const emitter = new EventEmitter();

      handleExportStream(emitter, cursor, false, req, options.cleanUp);

      options.serializeStream(cursor, emitter);
    }
    else
    {
      handleExportStream(cursor, cursor, true, req, options.cleanUp);
    }
  }

  function handleExportStream(queryStream, cursor, serializeRow, req, cleanUp)
  {
    queryStream.on('error', function(err)
    {
      next(err);

      if (cleanUp)
      {
        cleanUp(req);
      }
    });

    queryStream.on('end', function()
    {
      if (!cursorClosed)
      {
        writeHeader();

        if (!columns || columns.length === 0)
        {
          return;
        }

        if (format === 'xlsx')
        {
          finalizeXlsx();
        }
        else if (format === 'csv')
        {
          finalizeCsv();
        }
      }

      if (cleanUp)
      {
        cleanUp(req);
      }
    });

    queryStream.on('data', function(doc)
    {
      if (cursorClosed)
      {
        return;
      }

      const row = serializeRow ? options.serializeRow(doc, req) : doc;
      const multiple = Array.isArray(row);

      if (!row || (multiple && !row.length))
      {
        return;
      }

      if (columns === null)
      {
        columns = prepareExportColumns(format, options, Object.keys(multiple ? row[0] : row));
      }

      writeHeader(cursor);

      if (cursorClosed)
      {
        return;
      }

      if (multiple)
      {
        _.forEach(row, writeRow);
      }
      else
      {
        writeRow(row);
      }
    });
  }

  function writeHeader(cursor)
  {
    if (headerWritten)
    {
      return;
    }

    headerWritten = true;

    if (!columns || columns.length === 0)
    {
      res.attachment(options.filename + '.txt');
      res.end('NO DATA\r\n');

      return;
    }

    if (columns.length > 1100)
    {
      cursor.close();

      cursorClosed = true;

      app.debug('[express] Export killed: %s', JSON.stringify({
        url: req.url,
        user: app.user.createUserInfo(req.session.user, req),
        columns: columns.length
      }, null, 2));

      return;
    }

    res.attachment(options.filename + '.' + format);

    if (format === 'xlsx')
    {
      writeXlsxHeader();
    }
    else if (format === 'csv')
    {
      writeCsvHeader();
    }
  }

  function writeRow(row)
  {
    if (format === 'xlsx')
    {
      writeXlsxRow(row);
    }
    else if (format === 'csv')
    {
      writeCsvRow(row);
    }
  }

  function initializeXlsx()
  {
    const complete = _.once(err =>
    {
      if (err)
      {
        cursorClosed = true;
      }

      jsonToXlsx.kill();
      jsonToXlsx = null;

      if (!res.headersSent && err)
      {
        res.removeHeader('Content-Disposition');
        res.removeHeader('Content-Type');

        next(err);
      }
      else
      {
        res.end();
      }
    });

    jsonToXlsx = spawn(app.express.config.jsonToXlsxExe);

    jsonToXlsx.once('error', err => complete(err));
    jsonToXlsx.once('close', exitCode => complete(exitCode === 0 ? null : new Error('[jsonToXlsx] Unexpected exit!')));

    jsonToXlsx.stdout.on('data', data => res.write(data));

    jsonToXlsx.stdin.setEncoding('utf8');
    jsonToXlsx.stdin.on('error', () => {});

    jsonToXlsx.stderr.setEncoding('utf8');
    jsonToXlsx.stderr.on('data', data => process.stdout.write(data));

    setImmediate(stream);
  }

  function writeXlsxHeader()
  {
    const config = {
      sheetName: options.sheetName || options.filename,
      freezeRows: options.freezeRows || 0,
      freezeColumns: options.freezeColumns || 0,
      headerHeight: options.headerHeight || 0,
      subHeader: !!options.subHeader,
      columns: columns
    };

    if (jsonToXlsx)
    {
      jsonToXlsx.stdin.write(JSON.stringify(config) + '\r\n');
    }
  }

  function writeXlsxRow(row)
  {
    if (jsonToXlsx)
    {
      jsonToXlsx.stdin.write(JSON.stringify(row) + '\r\n');
    }
  }

  function finalizeXlsx()
  {
    if (jsonToXlsx)
    {
      jsonToXlsx.stdin.write('\r\n');
      jsonToXlsx.stdin.end();
    }
  }

  function initializeCsv()
  {
    stream();
  }

  function writeCsvHeader()
  {
    const line = columns
      .map(column => column.caption)
      .join(CSV_COLUMN_SEPARATOR);

    res.write(new Buffer([0xEF, 0xBB, 0xBF]));
    res.write(line + CSV_ROW_SEPARATOR);

    ++rowIndex;
  }

  function writeCsvRow(row)
  {
    ++rowIndex;

    const line = columns
      .map(function(column)
      {
        const rawValue = row[column.name];
        const formatter = CSV_FORMATTERS[options.subHeader && rowIndex === 2 ? 'string' : column.type];

        return formatter ? formatter(rawValue) : rawValue;
      })
      .join(CSV_COLUMN_SEPARATOR);

    res.write(line + CSV_ROW_SEPARATOR);
  }

  function finalizeCsv()
  {
    res.end();
  }
};

function prepareExportColumns(format, options, columnNames)
{
  const columnConfig = options.columns || {};
  let orderedColumnNames;

  if (format === 'csv')
  {
    orderedColumnNames = columnNames;
  }
  else
  {
    orderedColumnNames = Object
      .keys(columnConfig)
      .filter(c => columnConfig[c] && columnConfig[c].position > 0)
      .sort((a, b) => columnConfig[a].position - columnConfig[b].position);

    columnNames.forEach(c =>
    {
      if (!orderedColumnNames.includes(c))
      {
        orderedColumnNames.push(c);
      }
    });
  }

  return orderedColumnNames.map(name =>
  {
    const option = columnConfig[name];
    const column = {
      name: name,
      caption: name,
      type: 'string',
      width: 0
    };
    const type = EXPORT_SHORT_TYPES[name.charAt(0)];

    if (type)
    {
      column.type = type;
      column.caption = name.substring(1);
    }

    if (typeof option === 'number')
    {
      column.width = option;
    }
    else if (typeof option === 'string')
    {
      column.type = option;
    }
    else if (option)
    {
      Object.assign(column, option);
    }
    else if (typeof options.prepareColumn === 'function')
    {
      options.prepareColumn(column);
    }

    if (!column.width)
    {
      column.width = EXPORT_TYPE_WIDTHS[column.type];
    }

    return column;
  });
}

function populateQuery(query, rql)
{
  _.forEach(rql.selector.args, function(term)
  {
    if (term.name === 'populate' && term.args.length > 0)
    {
      if (Array.isArray(term.args[1]))
      {
        query.populate(term.args[0], term.args[1].join(' '));
      }
      else
      {
        query.populate(term.args[0]);
      }
    }
  });
}
