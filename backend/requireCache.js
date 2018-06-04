// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

/* eslint-disable no-underscore-dangle */

'use strict';

exports.built = false;
exports.cache = {};
exports.build = buildRequireCache;
exports.path = '';
exports.use = useRequireCache;
exports.save = saveRequireCacheToFile;

for (let i = 0, l = process.argv.length; i < l; ++i)
{
  const currentArg = process.argv[i];
  const nextArg = process.argv[i + 1];

  if (currentArg === '--cache-require' && nextArg)
  {
    exports.path = nextArg;
    exports.built = true;

    buildRequireCache();

    break;
  }

  if (currentArg === '--require-cache' && nextArg)
  {
    exports.path = nextArg;

    useRequireCache();

    break;
  }
}

function buildRequireCache()
{
  const Module = require('module');
  const originalRequire = Module.prototype.require;
  const requireCache = exports.cache;

  Module.prototype.require = function(request)
  {
    if (requireCache[this.id] === undefined)
    {
      requireCache[this.id] = {};
    }

    const resolvedRequest = Module._resolveFilename(request, this);

    if (resolvedRequest[0] === '/' || resolvedRequest[0] === '\\' || resolvedRequest[1] === ':')
    {
      requireCache[this.id][request] = resolvedRequest;
    }

    return originalRequire.call(this, request);
  };
}

function useRequireCache()
{
  const Module = require('module');
  const fs = require('fs');
  const originalResolveFilename = Module._resolveFilename;
  const requireCache = exports.cache = JSON.parse(fs.readFileSync(exports.path, 'utf8'));

  Module._resolveFilename = function(request, parent)
  {
    const parentRequireMap = requireCache[parent.id];

    if (parentRequireMap !== undefined)
    {
      const resolvedRequest = parentRequireMap[request];

      if (resolvedRequest !== undefined)
      {
        return resolvedRequest;
      }
    }

    return originalResolveFilename(request, parent);
  };
}

function saveRequireCacheToFile(path)
{
  if (!path)
  {
    path = exports.path;
  }

  require('fs').writeFileSync(path, JSON.stringify(exports.cache), 'utf8');
}
