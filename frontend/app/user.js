// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'underscore',
  'jquery',
  'app/i18n',
  'app/broker',
  'app/socket',
  'app/viewport',
  'app/core/pages/ErrorPage'
],
function(
  _,
  $,
  t,
  broker,
  socket,
  viewport,
  ErrorPage
) {
  'use strict';

  var user = {};

  socket.on('user.reload', function(userData)
  {
    user.reload(userData);
  });

  socket.on('user.deleted', function()
  {
    window.location.reload();
  });

  user.data = _.extend(window.GUEST_USER || {}, {
    name: t.bound('core', 'GUEST_USER_NAME')
  });

  delete window.GUEST_USER;

  /**
   * @param {Object} userData
   * @returns {undefined}
   */
  user.reload = function(userData)
  {
    if (_.isEqual(userData, user.data))
    {
      return;
    }

    var wasLoggedIn = user.isLoggedIn();

    if (_.isObject(userData) && Object.keys(userData).length > 0)
    {
      if (userData.loggedIn === false)
      {
        userData.name = t.bound('core', 'GUEST_USER_NAME');
      }

      if (userData.orgUnitType === 'unspecified')
      {
        userData.orgUnitType = null;
        userData.orgUnitId = null;
      }

      user.data = userData;
    }

    user.data.privilegesMap = null;

    broker.publish('user.reloaded');

    if (wasLoggedIn && !user.isLoggedIn())
    {
      broker.publish('user.loggedOut');
    }
    else if (!wasLoggedIn && user.isLoggedIn())
    {
      broker.publish('user.loggedIn');
    }
  };

  /**
   * @returns {boolean}
   */
  user.isLoggedIn = function()
  {
    return user.data.loggedIn === true;
  };

  /**
   * @param {boolean} [lastNameFirst]
   * @returns {string}
   */
  user.getLabel = function(lastNameFirst)
  {
    if (user.data.name)
    {
      return String(user.data.name);
    }

    if (user.data.lastName && user.data.firstName)
    {
      if (lastNameFirst)
      {
        return user.data.lastName + ' ' + user.data.firstName;
      }

      return user.data.firstName + ' ' + user.data.lastName;
    }

    return user.data.login;
  };

  /**
   * @returns {{id: string, label: string, ip: string, cname: string}}
   */
  user.getInfo = function()
  {
    return {
      id: user.data._id,
      ip: user.data.ip || user.data.ipAddress || '0.0.0.0',
      cname: window.COMPUTERNAME,
      label: user.getLabel()
    };
  };

  user.isAllowedTo = function(privilege)
  {
    if (user.data.super)
    {
      return true;
    }

    var userPrivileges = user.data.privileges;
    var anyPrivileges = (arguments.length === 1 ? [privilege] : Array.prototype.slice.call(arguments)).map(function(p)
    {
      return Array.isArray(p) ? p : [p];
    });

    if (anyPrivileges.length
      && user.data.local
      && anyPrivileges[0].some(function(privilege) { return privilege === 'LOCAL'; }))
    {
      return true;
    }

    if (!userPrivileges)
    {
      return false;
    }

    var isLoggedIn = user.isLoggedIn();

    if (!anyPrivileges.length)
    {
      return isLoggedIn;
    }

    for (var i = 0, l = anyPrivileges.length; i < l; ++i)
    {
      var allPrivileges = anyPrivileges[i];
      var actualMatches = 0;
      var requiredMatches = allPrivileges.length;

      for (var ii = 0; ii < requiredMatches; ++ii)
      {
        var requiredPrivilege = allPrivileges[ii];

        if (requiredPrivilege === 'USER')
        {
          actualMatches += isLoggedIn ? 1 : 0;
        }
        else
        {
          actualMatches += user.hasPrivilege(allPrivileges[ii]) ? 1 : 0;
        }
      }

      if (actualMatches === requiredMatches)
      {
        return true;
      }
    }

    return false;
  };

  user.auth = function()
  {
    var anyPrivileges = Array.prototype.slice.call(arguments);

    return function(req, referer, next)
    {
      if (user.isAllowedTo.apply(user, anyPrivileges))
      {
        next();
      }
      else
      {
        viewport.showPage(new ErrorPage({code: 401, req: req, referer: referer}));
      }
    };
  };

  user.hasPrivilege = function(privilege)
  {
    if (!user.data.privilegesMap)
    {
      if (!Array.isArray(user.data.privileges))
      {
        user.data.privileges = [];
      }

      user.data.privilegesString = '|' + user.data.privileges.join('|');
      user.data.privilegesMap = {};

      _.forEach(user.data.privileges, function(privilege) { user.data.privilegesMap[privilege] = true; });
    }

    if (privilege.charAt(privilege.length - 1) === '*')
    {
      return user.data.privilegesString.indexOf('|' + privilege.substr(0, privilege.length - 1)) !== -1;
    }

    return user.data.privilegesMap[privilege] === true;
  };

  user.getGuestUserData = function()
  {
    return window.GUEST_USER || {
      id: null,
      login: 'guest',
      name: t.bound('core', 'GUEST_USER_NAME'),
      loggedIn: false,
      super: false,
      privileges: []
    };
  };

  user.getRootUserData = function()
  {
    return window.ROOT_USER || {
      id: null,
      login: 'root',
      name: 'root',
      loggedIn: true,
      super: true,
      privileges: []
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

  window.user = user;

  return user;
});
