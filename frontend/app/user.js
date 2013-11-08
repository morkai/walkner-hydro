define([
  'jquery',
  'underscore',
  './core/pages/ErrorPage'
],
function(
  $,
  _,
  ErrorPage
) {
  'use strict';

  var user = window && typeof window.USER === 'object' && window.USER !== null
    ? window.USER : {};

  _.defaults(user, {
    loggedIn: false,
    _id: 'haxor1234567890123456789',
    login: 'h4x0r',
    email: 'someone@the.net',
    mobile: '0-CALL-ME-MAYBE',
    privileges: []
  });

  if (typeof user.ipAddress !== 'string')
  {
    user.ipAddress = '127.0.0.1';
  }

  /**
   * @return {boolean}
   */
  user.isLoggedIn = function()
  {
    return user.loggedIn === true;
  };

  /**
   * @param {string|Array.<string>} privilege
   * @return {boolean}
   */
  user.isAllowedTo = function(privilege)
  {
    if (!user.privileges)
    {
      return false;
    }

    if (typeof privilege === 'string')
    {
      return user.privileges.indexOf(privilege) !== -1;
    }

    var privileges = [].concat(privilege);

    for (var i = 0, l = privileges.length; i < l; ++i)
    {
      privilege = privileges[i];

      if (typeof privilege !== 'string'
        || user.privileges.indexOf(privilege) !== -1)
      {
        continue;
      }

      return false;
    }

    return true;
  };

  /**
   * @param {string|Array.<string>} privilege
   * @returns {function(app.core.Router, string, function)}
   */
  user.auth = function(privilege)
  {
    return function(req, referer, next)
    {
      if (user.isAllowedTo(privilege))
      {
        next();
      }
      else
      {
        new ErrorPage({code: 401, req: req, referer: referer}).render();
      }
    };
  };

  var sleepTimer = null;

  $(window).on('mousemove', function(e)
  {
    if (window.lastX !== e.clientX || window.lastY !== e.clientY)
    {
      if (sleepTimer !== null)
      {
        clearTimeout(sleepTimer);
      }

      sleepTimer = setTimeout(logout, 3600 * 1000);
    }

    window.lastX = e.clientX;
    window.lastY = e.clientY;
  });

  function logout()
  {
    window.location.href = '/logout';
  }

  return user;
});
