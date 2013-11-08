'use strict';

module.exports = function setUpCleaner(app, collectorModule)
{
  var settingsCollection = collectorModule.config.collection('settings');
  var allTagsCollection = collectorModule.config.collection('tags.all');

  var lastCleaningTime = 0;
  var removingDocs = false;
  var pendingDocs = [];
  var removedDocCount = 0;

  app.timeout(4321, function()
  {
    getLastCleaningTime(function()
    {
      var tagValues = {};
      var selector = {t: {$gte: lastCleaningTime}};

      if (lastCleaningTime === 0)
      {
        lastCleaningTime = Date.now();
      }

      var cursor = allTagsCollection.find(selector, {n: 1, v: 1}, {t: 1});

      cursor.each(function(err, doc)
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
        collectorModule.error(
          "Failed to read the last cleaning time: %s", err.message
        );
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

    var docsToRemove = pendingDocs;

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
          collectorModule.error(
            "Failed to update the last cleaning time: %s", err.message
          );
        }
        else
        {
          collectorModule.debug(
            "Removed %d redundant values!", removedDocCount
          );
        }
      }
    );
  }
};
