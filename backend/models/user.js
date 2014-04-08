// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

module.exports = function setupUserModel(app, mongoose)
{
  var userSchema = mongoose.Schema({
    login: {
      type: String,
      trim: true,
      required: true,
      unique: true
    },
    password: {
      type: String,
      trim: true,
      required: true,
      unique: true
    },
    email: {
      type: String,
      trim: true,
      required: true,
      unique: true
    },
    mobile: {
      type: String,
      trim: true
    },
    privileges: {
      type: [String]
    }
  }, {
    toJSON: {
      virtuals: true,
      transform: function(alarm, ret)
      {
        ret._id = ret.id;

        delete ret.id;
        delete ret.password;

        return ret;
      }
    }
  });

  mongoose.model('User', userSchema);
};
