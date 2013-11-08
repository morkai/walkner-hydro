'use strict';

module.exports = function setupEventModel(app, mongoose)
{
  var eventSchema = mongoose.Schema({
    type: {
      type: String,
      trim: true,
      required: true
    },
    severity: {
      type: String,
      enum: ['debug', 'info', 'warning', 'error'],
      default: 'info'
    },
    time: {
      type: Number,
      default: Date.now
    },
    user: {
      type: Object
    },
    data: {
      type: Object
    }
  }, {
    toJSON: {
      virtuals: true,
      transform: function(event, ret)
      {
        ret._id = ret.id;

        delete ret.id;

        return ret;
      }
    }
  });

  eventSchema.index({time: -1, severity: 1});
  eventSchema.index({time: -1, type: 1});

  mongoose.model('Event', eventSchema);
};
