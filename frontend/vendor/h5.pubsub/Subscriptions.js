define(function(require, exports, module) {
module.exports = Subscriptions;

var EMPTY_TOPIC_PARTS = [];

/**
 * @name h5.pubsub.Subscriptions
 * @constructor
 * @param {h5.pubsub.MessageBroker} messageBroker
 */
function Subscriptions(messageBroker)
{
  /**
   * @private
   * @type {h5.pubsub.MessageBroker}
   */
  this.messageBroker = messageBroker;

  /**
   * @private
   * @type {object.<string, h5.pubsub.Subscriptions>|null}
   */
  this.children = null;

  /**
   * @private
   * @type {h5.pubsub.Subscription|Array.<h5.pubsub.Subscription>|null}
   */
  this.subscriptions = null;

  /**
   * @private
   * @type {Array.<number>|null}
   */
  this.subscriptionsPendingRemoval = null;

  /**
   * @private
   * @type {number}
   */
  this.sendingMessagesCount = 0;

  /**
   * @private
   * @type {function(h5.pubsub.Subscription)}
   */
  this.removeSubscription = this.removeSubscription.bind(this);
}

Subscriptions.TOKEN = {
  SEPARATOR: '.',
  ANY: '*',
  ALL: '**'
};

Subscriptions.prototype.destroy = function()
{
  var children = this.children;

  if (children !== null)
  {
    var childTopicParts = Object.keys(children);

    for (var i = 0, l = childTopicParts.length; i < l; ++i)
    {
      children[childTopicParts[i]].destroy();
    }

    this.children = null;
  }

  this.removeSubscriptions();

  this.subscriptionsPendingRemoval = null;
  this.messageBroker = null;
};

/**
 * @param {string} prefix
 * @param {object.<string, number>} result
 */
Subscriptions.prototype.count = function(prefix, result)
{
  if (this.subscriptions !== null)
  {
    result[prefix] = this.subscriptions.length || 1;
  }

  if (this.children !== null)
  {
    if (prefix.length !== 0)
    {
      prefix += Subscriptions.TOKEN.SEPARATOR;
    }

    var childTopicParts = Object.keys(this.children);

    for (var i = 0, l = childTopicParts.length; i < l; ++i)
    {
      var childTopicPart = childTopicParts[i];

      this.children[childTopicPart].count(prefix + childTopicPart, result);
    }
  }
};

/**
 * @param {h5.pubsub.Subscription} subscription
 * @throws {Error} If the subscription topic is not valid.
 */
Subscriptions.prototype.add = function(subscription)
{
  var topicParts = this.splitTopic(subscription.getTopic());

  this.addSubscription(topicParts, subscription);
};

/**
 * @param {string} topic
 * @throws {Error} If the subscription topic is not valid.
 */
Subscriptions.prototype.remove = function(topic)
{
  this.removeSubscriptions(this.splitTopic(topic));
};

/**
 * @param {string} topic
 * @param {*} message
 * @param {object} meta
 * @throws {Error} If the specified topic is not valid.
 */
Subscriptions.prototype.send = function(topic, message, meta)
{
  var topicParts = this.splitTopic(topic);

  this.sendMessage(topicParts, topic, message, meta);
};

/**
 * @private
 * @param {Array.<string>} topicParts
 * @param {h5.pubsub.Subscription} subscription
 */
Subscriptions.prototype.addSubscription = function(topicParts, subscription)
{
  var subscriptions = this.subscriptions;

  if (topicParts.length === 0)
  {
    if (subscriptions === null)
    {
      this.subscriptions = subscription;
    }
    else if (typeof subscriptions.length === 'undefined')
    {
      this.subscriptions = [subscriptions, subscription];
    }
    else
    {
      subscriptions.push(subscription);
    }

    subscription.on('cancel', this.removeSubscription);

    if (this.subscriptions === subscription)
    {
      this.messageBroker.emit('new topic', subscription.getTopic());
    }

    return;
  }

  if (this.children === null)
  {
    this.children = {};
  }

  var children = this.children;
  var topicPart = topicParts.shift();

  if (!(topicPart in children))
  {
    children[topicPart] = new Subscriptions(this.messageBroker);
  }

  children[topicPart].addSubscription(topicParts, subscription);
};

/**
 * @private
 * @param {Array.<string>=} topicParts
 */
Subscriptions.prototype.removeSubscriptions = function(topicParts)
{
  if (typeof topicParts === 'undefined' || topicParts.length === 0)
  {
    var subscriptions = this.subscriptions;

    if (subscriptions === null)
    {
      return;
    }

    this.subscriptions = null;

    var emptyTopic;

    if (typeof subscriptions.length === 'undefined')
    {
      subscriptions.cancel();

      emptyTopic = subscriptions.getTopic();
    }
    else
    {
      emptyTopic = subscriptions[0].getTopic();

      for (var i = 0, l = subscriptions.length; i < l; ++i)
      {
        subscriptions[i].cancel();
      }
    }

    this.messageBroker.emit('empty topic', emptyTopic);

    return;
  }

  if (this.children === null)
  {
    return;
  }

  var topicPart = topicParts.shift();

  if (topicPart in this.children)
  {
    this.children[topicPart].removeSubscriptions(topicParts);
  }
};

/**
 * @private
 * @param {Array.<string>} topicParts
 * @param {string} topic
 * @param {*} message
 * @param {object} meta
 */
Subscriptions.prototype.sendMessage = function(topicParts, topic, message, meta)
{
  ++this.sendingMessagesCount;

  var hasAnyChildren = this.children !== null;

  if (hasAnyChildren && Subscriptions.TOKEN.ALL in this.children)
  {
    this.children[Subscriptions.TOKEN.ALL].sendMessage(
      EMPTY_TOPIC_PARTS, topic, message, meta
    );
  }

  if (topicParts.length === 0)
  {
    if (this.subscriptions !== null)
    {
      if (typeof this.subscriptions.length === 'undefined')
      {
        this.subscriptions.send(topic, message, meta);
      }
      else
      {
        for (var i = 0, l = this.subscriptions.length; i < l; ++i)
        {
          this.subscriptions[i].send(topic, message, meta);
        }
      }
    }
  }
  else if (hasAnyChildren)
  {
    var topicPart = topicParts.shift();

    if (Subscriptions.TOKEN.ANY in this.children)
    {
      this.children[Subscriptions.TOKEN.ANY].sendMessage(
        [].concat(topicParts), topic, message, meta
      );
    }

    if (topicPart in this.children)
    {
      this.children[topicPart].sendMessage(topicParts, topic, message, meta);
    }
  }

  --this.sendingMessagesCount;

  this.removePendingSubscriptions();
};

/**
 * @private
 * @param {string} topic
 * @return {Array.<string>}
 * @throws {Error} If the specified topic is empty.
 */
Subscriptions.prototype.splitTopic = function(topic)
{
  var topicParts = topic
    .split(Subscriptions.TOKEN.SEPARATOR)
    .filter(function(part)
    {
      return part.length !== 0;
    });

  if (topicParts.length === 0)
  {
    throw new Error("Invalid subscription topic: " + topic);
  }

  return topicParts;
};

/**
 * @private
 * @param {h5.pubsub.Subscription} subscription
 */
Subscriptions.prototype.removeSubscription = function(subscription)
{
  this.messageBroker.emit('cancel', subscription);

  var subscriptions = this.subscriptions;

  if (subscriptions === null)
  {
    return;
  }

  if (subscriptions === subscription)
  {
    this.subscriptions = null;

    this.messageBroker.emit('empty topic', subscription.getTopic());

    return;
  }

  var initialSubscriptionCount = subscriptions.length;

  if (typeof initialSubscriptionCount === 'number')
  {
    var subscriptionIndex = -1;

    for (var i = 0; i < initialSubscriptionCount; ++i)
    {
      if (subscriptions[i] === subscription)
      {
        subscriptionIndex = i;

        break;
      }
    }

    if (subscriptionIndex !== -1)
    {
      if (this.sendingMessagesCount > 0)
      {
        if (this.subscriptionsPendingRemoval === null)
        {
          this.subscriptionsPendingRemoval = [subscriptionIndex];
        }
        else
        {
          this.subscriptionsPendingRemoval.push(subscriptionIndex);
        }

        return;
      }

      subscriptions.splice(subscriptionIndex, 1);

      if (initialSubscriptionCount === 2)
      {
        this.subscriptions = subscriptions[0];
      }
    }
  }
};

/**
 * @private
 */
Subscriptions.prototype.removePendingSubscriptions = function()
{
  var subscriptionsPendingRemoval = this.subscriptionsPendingRemoval;

  if (subscriptionsPendingRemoval === null || this.sendingMessagesCount > 0)
  {
    return;
  }

  var subscriptions = this.subscriptions;

  for (var i = 0, l = subscriptionsPendingRemoval.length; i < l; ++i)
  {
    subscriptions.splice(subscriptionsPendingRemoval[i], 1);
  }

  var remainingSubscriptions = subscriptions.length;

  if (remainingSubscriptions === 1)
  {
    this.subscriptions = subscriptions[0];
  }

  this.subscriptionsPendingRemoval = null;
};

});
