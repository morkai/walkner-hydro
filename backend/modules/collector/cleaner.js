// Part of <https://miracle.systems/p/walkner-furmon> licensed under <CC BY-NC-SA 4.0>

'use strict';

module.exports = function setUpCleaner(app, module)
{
  const settingsCollection = module.config.collection('tags.settings');
  const allTagsCollection = module.config.collection('tags.all');

  let lastCleaningTime = 0;
  let removingDocs = false;
  let pendingDocs = [];
  let removedDocCount = 0;

  app.timeout(4321, function()
  {
    getLastCleaningTime(function()
    {
      const tagValues = {};
      const selector = {t: {$gte: lastCleaningTime}};

      if (lastCleaningTime === 0)
      {
        lastCleaningTime = Date.now();
      }

      const cursor = allTagsCollection.find(selector, {n: 1, v: 1}, {t: 1});

      cursor.forEach(function(err, doc)
      {
        if (err)
        {
          return;
        }

        if (!doc)
        {
          return removePendingDocs(true);
        }

        var oldValue = tagValues[doc.n];

        if (typeof oldValue === 'undefined')
        {
          tagValues[doc.n] = doc.v;

          return;
        }

        if (oldValue === doc.v)
        {
          pendingDocs.push(doc._id);

          return removePendingDocs(false);
        }

        tagValues[doc.n] = doc.v;
      });
    });
  });

  /**
   * @private
   * @param {function} done
   */
  function getLastCleaningTime(done)
  {
    settingsCollection.findOne({_id: 'lastCleaningTime'}, function(err, doc)
    {
      if (err)
      {
        module.error(`Failed to read the last cleaning time: ${err.message}`);
      }

      if (doc)
      {
        lastCleaningTime = doc.value;
      }

      done();
    });
  }

  /**
   * @private
   * @param {boolean} force
   */
  function removePendingDocs(force)
  {
    if (!force && (removingDocs || pendingDocs.length < 100))
    {
      return;
    }

    removingDocs = true;

    const docsToRemove = pendingDocs;

    pendingDocs = [];

    allTagsCollection.remove({_id: {$in: docsToRemove}}, function()
    {
      removingDocs = false;
      removedDocCount += docsToRemove.length;

      if (force)
      {
        pendingDocs = null;

        updateLastCleaningTime();
      }
    });
  }

  /**
   * @private
   */
  function updateLastCleaningTime()
  {
    if (removedDocCount === 0)
    {
      return;
    }

    settingsCollection.update(
      {_id: 'lastCleaningTime'},
      {$set: {time: lastCleaningTime, value: lastCleaningTime}},
      function(err)
      {
        if (err)
        {
          module.error(`Failed to update the last cleaning time: ${err.message}`);
        }
        else
        {
          module.debug('Removed ${removedDocCount} redundant values!');
        }
      }
    );
  }
};
