define(function(require, exports, module) {var Subscription = require('./Subscription');

module.exports = Sandbox;

/**
 * @name h5.pubsub.Sandbox
 * @constructor
 * @implements {h5.pubsub.Broker}
 * @param {h5.pubsub.Broker} broker
 */
function Sandbox(broker)
{
  /**
   * @private
   * @type {h5.pubsub.Broker}
   */
  this.broker = broker;

  /**
   * @private
   * @type {object.<string, h5.pubsub.Subscription>}
   */
  this.subscriptions = {};

  /**
   * @private
   * @type {function(h5.pubsub.Subscription)}
   */
  this.removeSubscription = this.removeSubscription.bind(this);
}

Sandbox.prototype.destroy = function()
{
  var subscriptions = this.subscriptions;

  for (var id in subscriptions)
  {
    if (subscriptions.hasOwnProperty(id))
    {
      subscriptions[id].cancel();
    }
  }

  this.subscriptions = null;
  this.broker = null;
};

/**
 * @return {h5.pubsub.Sandbox}
 */
Sandbox.prototype.sandbox = function()
{
  return new Sandbox(this);
};

/**
 * @param {string} topic
 * @param {*} [message]
 * @param {object} [meta]
 * @return {h5.pubsub.Sandbox}
 */
Sandbox.prototype.publish = function(topic, message, meta)
{
  this.broker.publish(topic, message, meta);

  return this;
};

/**
 * @param {string} topic
 * @param {function(string, *, object)} [onMessage]
 * @return {h5.pubsub.Subscription}
 */
Sandbox.prototype.subscribe = function(topic, onMessage)
{
  var subscription = this.broker.subscribe(topic, onMessage);

  subscription.on('cancel', this.removeSubscription);

  this.subscriptions[subscription.getId()] = subscription;

  return subscription;
};

/**
 * @param {string} topic
 * @return {h5.pubsub.Sandbox}
 */
Sandbox.prototype.unsubscribe = function(topic)
{
  var ids = [];
  var subscriptions = this.subscriptions;

  for (var id in subscriptions)
  {
    if (subscriptions.hasOwnProperty(id)
      && subscriptions[id].getTopic() === topic)
    {
      ids.push(id);
    }
  }

  for (var i = 0, l = ids.length; i < l; ++i)
  {
    subscriptions[ids[i]].cancel();
  }

  return this;
};

/**
 * @private
 * @param {h5.pubsub.Subscription} subscription
 */
Sandbox.prototype.removeSubscription = function(subscription)
{
  delete this.subscriptions[subscription.getId()];
};

});
