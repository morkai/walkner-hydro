'use strict';

var nodemailer = require('nodemailer');

exports.DEFAULT_CONFIG = {
  controllerId: 'controller',
  serviceType: null,
  serviceOptions: {},
  from: {tagName: 'mailer.from', default: 'someone@the.net'},
  bcc: {tagName: 'mailer.bcc', default: ''},
  replyTo: {tagName: 'mailer.replyTo', default: 'someone@the.net'},
};

exports.start = function startMailerModule(app, module)
{
  var config = module.config;
  var transport = nodemailer.createTransport(
    module.config.transport,
    module.config.options
  );

  /**
   * @param {string|Array.<string>} to
   * @param {string} subject
   * @param {string} text
   * @param {function(Error|null, object)} done
   */
  module.send = function(to, subject, text, done)
  {
    var controller = app[config.controllerId];
    var values = controller && controller.values ? controller.values : {};
    var mailOptions = {
      from: String(values[config.from.tagName] || config.from.default),
      to: Array.isArray(to) ? to.join(', ') : to,
      bcc: String(values[config.bcc.tagName] || config.bcc.default),
      replyTo: String(values[config.replyTo.tagName] || config.replyTo.default),
      subject: subject,
      text: String(text)
    };

    transport.sendMail(mailOptions, done);
  };
};
