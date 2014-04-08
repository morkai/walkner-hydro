// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

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
