// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const util = require('util');
const Store = require('express-session').Store;

module.exports = MongoStore;

/**
 * @constructor
 * @param {Db} db
 * @param {MongoStore.Options} [options]
 */
function MongoStore(db, options)
{
  options = options || {};

  Store.call(this, options);

  /**
   * @private
   * @type {string}
   */
  this.collectionName = options.collectionName || MongoStore.Options.collectionName;

  /**
   * @private
   * @type {boolean}
   */
  this.safe = options.safe === true;

  /**
   * @private
   * @type {number}
   */
  this.gcInterval = (options.gcInterval || MongoStore.Options.gcInterval) * 1000;

  /**
   * @private
   * @type {number}
   */
  this.defaultExpirationTime
    = (options.defaultExpirationTime || MongoStore.Options.defaultExpirationTime) * 1000;

  /**
   * @private
   * @type {number}
   */
  this.touchChance = options.touchChance || MongoStore.Options.touchChance;

  /**
   * @private
   * @type {number}
   */
  this.touchInterval = options.touchInterval || MongoStore.Options.touchInterval;

  /**
   * @private
   * @type {number|null}
   */
  this.gcTimer = null;

  /**
   * @private
   * @type {Db}
   */
  this.db = db;

  /**
   * @private
   * @type {function}
   */
  this.onOpen = this.onOpen.bind(this);

  /**
   * @private
   * @type {function}
   */
  this.onClose = this.onClose.bind(this);

  this.db.on('reconnect', this.onOpen);
  this.db.on('close', this.onClose);

  this.scheduleGc();
}

/**
 * @type {object}
 */
MongoStore.Options = {
  /**
   * @type {string}
   */
  collectionName: 'sessions',

  /**
   * @type {boolean}
   */
  safe: false,

  /**
   * @type {number}
   */
  gcInterval: 600,

  /**
   * @type {number}
   */
  defaultExpirationTime: 3600 * 24 * 14,

  /**
   * @type {number}
   */
  touchChance: 0.25,

  /**
   * @type {number}
   */
  touchInterval: 0
};

util.inherits(MongoStore, Store);

MongoStore.prototype.touch = function(sid, session, done)
{
  const now = Date.now();

  if ((this.touchInterval > 0 && (now - session.updatedAt) < this.touchInterval)
    || (this.touchChance > 0 && Math.random() > this.touchChance))
  {
    return done(null);
  }

  const sessions = this.collection();
  const expires = Date.parse(session.cookie.expires) || (Date.now() + this.defaultExpirationTime);

  sessions.update({_id: sid}, {$set: {expires, updatedAt: now}}, done);
};

/**
 * @param {string} sid
 * @param {function} done
 */
MongoStore.prototype.get = function(sid, done)
{
  const store = this;

  this.collection().findOne({_id: sid}, {_id: 0, data: 1, updatedAt: 1}, function(err, doc)
  {
    if (err)
    {
      return done(err);
    }

    if (doc === null)
    {
      return done();
    }

    const session = typeof doc.data === 'string' ? JSON.parse(doc.data) : doc.data;
    const expires = typeof session.cookie.expires === 'string'
      ? new Date(session.cookie.expires)
      : session.cookie.expires;

    if (!expires || Date.now() < expires)
    {
      session.updatedAt = doc.updatedAt;

      return done(null, session);
    }

    return store.destroy(sid, done);
  });
};

/**
 * @param {string} sid
 * @param {Session} session
 * @param {function} [done]
 */
MongoStore.prototype.set = function(sid, session, done)
{
  const sessions = this.collection();
  const now = Date.now();
  const doc = {
    _id: sid,
    updatedAt: now,
    expires: Date.parse(session.cookie.expires),
    data: session
  };

  if (isNaN(doc.expires))
  {
    doc.expires = now + this.defaultExpirationTime;
  }

  const opts = {
    upsert: true,
    safe: this.safe
  };

  sessions.update({_id: sid}, doc, opts, function(err)
  {
    return done && done(err);
  });
};

/**
 * @param {string} sid
 * @param {function} [done]
 */
MongoStore.prototype.destroy = function(sid, done)
{
  this.collection().remove({_id: sid}, {safe: this.safe}, function(err)
  {
    return done && done(err);
  });
};

/**
 * @param {function} [done]
 */
MongoStore.prototype.clear = function(done)
{
  this.collection().drop(done);
};

/**
 * @param {function} done
 */
MongoStore.prototype.length = function(done)
{
  this.collection().count(done);
};

/**
 * @param {function} [done]
 */
MongoStore.prototype.gc = function(done)
{
  this.collection().remove({expires: {$lte: Date.now()}}, done);
};

MongoStore.prototype.destruct = function()
{
  this.clearGcTimer();

  this.db.removeListener('open', this.onOpen);
  this.db.removeListener('close', this.onClose);
  this.db = null;
};

/**
 * @private
 * @returns {Object}
 */
MongoStore.prototype.collection = function()
{
  return this.db.collection(this.collectionName);
};

/**
 * @private
 */
MongoStore.prototype.onOpen = function()
{
  this.scheduleGc();
};

/**
 * @private
 */
MongoStore.prototype.onClose = function()
{
  this.clearGcTimer();
};

/**
 * @private
 */
MongoStore.prototype.clearGcTimer = function()
{
  if (this.gcTimer !== null)
  {
    clearTimeout(this.gcTimer);
    this.gcTimer = null;
  }
};

/**
 * @private
 */
MongoStore.prototype.scheduleGc = function()
{
  this.gcTimer = setTimeout(
    function(store)
    {
      store.gcTimer = null;
      store.gc(function() { store.scheduleGc(); });
    },
    this.gcInterval,
    this
  );
};
