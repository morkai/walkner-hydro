'use strict';

module.exports = Lock;

/**
 * @constructor
 */
function Lock()
{
  /**
   * @private
   * @type {boolean}
   */
  this.active = false;

  /**
   * @type {function|null}
   */
  this.cb = null;
}

Lock.prototype.isLocked = function()
{
  return this.active;
};

Lock.prototype.on = function()
{
  this.active = true;
};

Lock.prototype.off = function()
{
  this.active = false;

  if (this.cb !== null)
  {
    process.nextTick(this.cb);

    this.cb = null;
  }
};
