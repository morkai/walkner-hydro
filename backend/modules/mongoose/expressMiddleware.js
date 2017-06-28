'use strict';

const mongoose = require('mongoose');

module.exports = function(app, module, req, res, next)
{
  if (module.connection.readyState === mongoose.Connection.STATES.connected)
  {
    return next();
  }

  res.status(503).format({
    text: function()
    {
      res.send("503 - Service Unavailable - No database connection. Please try again later.");
    },
    html: function()
    {
      res.render('mongoose:unavailable');
    },
    json: function()
    {
      res.json({
        error: {message: '503'}
      });
    }
  });
};
