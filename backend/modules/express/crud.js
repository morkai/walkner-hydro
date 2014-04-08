// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

/*jshint maxparams:5*/

'use strict';

var step = require('h5.step');
var mongoSerializer = require('h5.rql/lib/serializers/mongoSerializer');

exports.browseRoute = function(app, Model, req, res, next)
{
  var queryOptions = mongoSerializer.fromQuery(req.rql);

  step(
    function countStep()
    {
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
        Model
          .find(queryOptions.selector, queryOptions.fields, queryOptions)
          .lean()
          .exec(this.next());
      }
    },
    function sendResponseStep(err, models)
    {
      if (err)
      {
        return this.done(next, err);
      }

      var totalCount = this.totalCount;

      if (typeof Model.customizeLeanObject === 'function'
        && totalCount > 0)
      {
        models = models.map(function(leanModel)
        {
          return Model.customizeLeanObject(leanModel, queryOptions.fields);
        });
      }

      res.format({
        json: function()
        {
          res.json({
            totalCount: totalCount,
            collection: models
          });
        }
      });
    }
  );
};

exports.addRoute = function(app, Model, req, res, next)
{
  var model = new Model(req.body);

  model.save(function(err)
  {
    if (err)
    {
      return next(err);
    }

    res.format({
      json: function()
      {
        res.send(201, model);
      }
    });

    app.broker.publish(Model.collection.name + '.added', {
      model: model.toJSON(),
      user: req.session.user
    });
  });
};

exports.readRoute = function(app, Model, req, res, next)
{
  Model.findById(req.params.id, null, function(err, model)
  {
    if (err)
    {
      return next(err);
    }

    if (model === null)
    {
      return res.send(404);
    }

    res.format({
      json: function()
      {
        try
        {
          res.send(model);
        }
        catch (err)
        {
          next(err);
        }
      }
    });
  });
};

exports.editRoute = function(app, Model, req, res, next)
{
  Model.findById(req.params.id, function(err, model)
  {
    if (err)
    {
      return next(err);
    }

    if (model === null)
    {
      return res.send(404);
    }

    model.set(req.body);
    model.save(function(err)
    {
      if (err)
      {
        return next(err);
      }

      res.format({
        json: function()
        {
          res.send(model);
        }
      });

      app.broker.publish(Model.collection.name + '.edited', {
        model: model.toJSON(),
        user: req.session.user
      });
    });
  });
};

exports.deleteRoute = function(app, Model, req, res, next)
{
  Model.findById(req.params.id, function(err, model)
  {
    if (err)
    {
      return next(err);
    }

    if (model === null)
    {
      return res.send(404);
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
          res.send(204);
        }
      });

      app.broker.publish(Model.collection.name + '.deleted', {
        model: model.toJSON(),
        user: req.session.user
      });
    });
  });
};
