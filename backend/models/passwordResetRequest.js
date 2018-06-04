// Part of <http://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

module.exports = function setUpPasswordResetRequestModel(app, mongoose)
{
  var passwordResetRequest = new mongoose.Schema({
    _id: String,
    createdAt: {
      type: Date,
      required: true
    },
    creator: {},
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    password: {
      type: String,
      required: true
    }
  }, {
    id: false
  });

  mongoose.model('PasswordResetRequest', passwordResetRequest);
};
