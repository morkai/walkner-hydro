// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var step = require('h5.step');
var mongoSerializer = require('h5.rql/lib/serializers/mongoSerializer');

var CSV_COLUMN_SEPARATOR = ';';
var CSV_ROW_SEPARATOR = '\r\n';
var CSV_FORMATTERS = {
  '"': function(value)
  {
    if (value === null || value === undefined || value === '')
    {
      return '""';
    }

    return '"' + String(value).replace(/"/g, '""') + '"';
  },
  '#': function(value)
  {
    if (value === null || value === undefined || value === '')
    {
      return '';
    }

    return parseFloat(Number(value).toFixed(3)).toString().replace('.', ',');
  }
};

exports.browseRoute = function(app, options, req, res, next)
{
  var Model;

  if (options.model && options.model.model)
  {
    Model = options.model;
  }
  else
  {
    Model = options;
    options = {};
  }

  var queryOptions = mongoSerializer.fromQuery(req.rql);

  if (queryOptions.limit === 0)
  {
    queryOptions.limit = typeof Model.BROWSE_LIMIT === 'number' ? Model.BROWSE_LIMIT : 100;
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
        var query = Model.find(queryOptions.selector, queryOptions.fields, queryOptions).lean();

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

      var totalCount = this.totalCount;

      if (typeof Model.customizeLeanObject === 'function' && totalCount > 0)
      {
        models = models.map(function(leanModel)
        {
          return Model.customizeLeanObject(leanModel, queryOptions.fields);
        });
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
  var model = req.model || new Model(req.body);

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

        var matches = err.message.match(/\.\$(.*?) /);

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
  var Model;

  if (options.model && options.model.model)
  {
    Model = options.model;
  }
  else
  {
    Model = options;
    options = {};
  }

  var queryOptions = mongoSerializer.fromQuery(req.rql);
  var query = Model.findById(req.params.id, queryOptions.fields).lean();

  try
  {
    populateQuery(query, req.rql);
  }
  catch (err)
  {
    return next(err);
  }

  query.exec(function(err, model)
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
  });

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
  var Model;

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

          var matches = err.message.match(/\.\$(.*?) /);

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

exports.exportRoute = function(options, req, res, next)
{
  var queryOptions = mongoSerializer.fromQuery(req.rql);
  var headerWritten = false;
  var columnNames = null;

  var query = options.model
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

  if (options.serializeStream)
  {
    var emitter = new EventEmitter();

    handleExportStream(emitter, false, req, options.cleanUp);

    options.serializeStream(query.cursor(), emitter);
  }
  else
  {
    handleExportStream(query.cursor(), true, req, options.cleanUp);
  }

  function handleExportStream(queryStream, serializeRow, req, cleanUp)
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
      writeHeader();
      res.end();

      if (cleanUp)
      {
        cleanUp(req);
      }
    });

    queryStream.on('data', function(doc)
    {
      var row = serializeRow ? options.serializeRow(doc, req) : doc;
      var multiple = Array.isArray(row);

      if (!row || (multiple && !row.length))
      {
        return;
      }

      if (columnNames === null)
      {
        columnNames = Object.keys(multiple ? row[0] : row);
      }

      writeHeader();

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

  function writeHeader()
  {
    if (headerWritten)
    {
      return;
    }

    if (columnNames === null)
    {
      return res.sendStatus(204);
    }

    res.attachment(options.filename + '.csv');

    var line = columnNames
      .map(function(columnName)
      {
        return CSV_FORMATTERS[columnName.charAt(0)] ? columnName.substr(1) : columnName;
      })
      .join(CSV_COLUMN_SEPARATOR);

    res.write(new Buffer([0xEF, 0xBB, 0xBF]));
    res.write(line + CSV_ROW_SEPARATOR);

    headerWritten = true;
  }

  function writeRow(row)
  {
    var line = columnNames
      .map(function(columnName)
      {
        var formatter = CSV_FORMATTERS[columnName.charAt(0)];

        return formatter ? formatter(row[columnName]) : row[columnName];
      })
      .join(CSV_COLUMN_SEPARATOR);

    res.write(line + CSV_ROW_SEPARATOR);
  }
};

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
