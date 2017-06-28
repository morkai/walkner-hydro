// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

define([
  'underscore',
  'moment',
  'app/broker'
], function(
  _,
  moment,
  broker
) {
  'use strict';

  var allDomains = {};
  var allModules = [];

  /**
   * @param {string} domain
   * @param {string} key
   * @param {object.<string, string|number>} [data]
   * @returns {string}
   */
  function translate(domain, key, data)
  {
    try
    {
      return allDomains[domain][key](data);
    }
    catch (err)
    {
      if (allDomains[domain] && allDomains[domain][key])
      {
        throw err;
      }

      broker.publish('i18n.missingKey', {
        domain: domain,
        key: key
      });

      return key;
    }
  }

  /**
   * @param {string} domain
   * @param {object.<string, function>} keys
   * @param {string} [moduleId]
   */
  function register(domain, keys, moduleId)
  {
    allDomains[domain] = keys;

    if (typeof moduleId === 'string')
    {
      allModules.push(moduleId);
    }

    broker.publish('i18n.registered', {
      domain: domain,
      keys: keys,
      moduleId: moduleId
    });
  }

  /**
   * @param {string} newLocale
   * @param {function} [done]
   */
  function reload(newLocale, done)
  {
    var oldLocale = 'en';

    if (_.isObject(translate.config))
    {
      oldLocale = translate.config.locale;
      translate.config.locale = newLocale;
    }

    allModules.forEach(require.undef);

    var modules = [].concat(allModules);

    if (newLocale !== 'en')
    {
      modules.unshift('moment-lang/' + newLocale);
    }

    modules.unshift('select2-lang/' + newLocale);

    require(modules, function()
    {
      moment.locale(newLocale);

      broker.publish('i18n.reloaded', {
        oldLocale: oldLocale,
        newLocale: newLocale
      });

      if (_.isFunction(done))
      {
        done();
      }
    });
  }

  /**
   * @param {string} domain
   * @param {string} key
   * @param {object.<string, string|number>} [data]
   * @returns {function(): string}
   */
  function bound(domain, key, data)
  {
    function boundTranslate()
    {
      return translate(domain, key, data);
    }

    boundTranslate.toString = boundTranslate;

    return boundTranslate;
  }

  /**
   * @param {string} domain
   * @param {string} key
   * @returns {boolean}
   */
  function has(domain, key)
  {
    return typeof allDomains[domain] !== 'undefined'
      && typeof allDomains[domain][key] === 'function';
  }

  function flatten(obj)
  {
    var result = {};

    if (obj == null)
    {
      return result;
    }

    var keys = Object.keys(obj);

    for (var i = 0, l = keys.length; i < l; ++i)
    {
      var key = keys[i];
      var value = obj[key];

      if (value !== null && typeof value === 'object')
      {
        var flatObj = flatten(value);
        var flatKeys = Object.keys(flatObj);

        for (var ii = 0, ll = flatKeys.length; ii < ll; ++ii)
        {
          result[key + '->' + flatKeys[ii]] = String(flatObj[flatKeys[ii]]);
        }
      }
      else
      {
        result[key] = _.escape(String(value));
      }
    }

    return result;
  }

  translate.config = null;
  translate.translate = translate;
  translate.register = register;
  translate.reload = reload;
  translate.bound = bound;
  translate.has = has;
  translate.flatten = flatten;
  translate.forDomain = function(defaultDomain)
  {
    var defaultTranslate = function(domain, key, data)
    {
      if (typeof key === 'object')
      {
        return translate(defaultDomain, domain, key);
      }

      if (typeof key === 'string' || data)
      {
        return translate(domain, key, data);
      }

      return translate(defaultDomain, domain);
    };

    defaultTranslate.translate = defaultTranslate;
    defaultTranslate.bound = function(domain, key, data)
    {
      function boundTranslate()
      {
        return defaultTranslate(domain, key, data);
      }

      boundTranslate.toString = boundTranslate;

      return boundTranslate;
    };
    defaultTranslate.has = function(domain, key)
    {
      if (!key)
      {
        return has(defaultDomain, domain);
      }

      return has(domain, key);
    };
    defaultTranslate.flatten = flatten;

    return defaultTranslate;
  };

  window.i18n = translate;

  return translate;
});
