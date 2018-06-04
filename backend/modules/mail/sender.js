// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const step = require('h5.step');

exports.DEFAULT_CONFIG = {
  smtp: null,
  from: 'someone@the.net',
  bcc: '',
  replyTo: 'someone@the.net',
  expressId: 'express',
  secretKey: null,
  remoteSenderUrl: null,
  emailsPath: null
};

const HEADERS = {
  to: 'to',
  cc: 'cc',
  bcc: 'bcc',
  from: 'from',
  replyto: 'replyTo',
  subject: 'subject',
  html: 'html'
};

exports.start = function startMailSenderModule(app, module)
{
  let nodemailer;
  let request;

  if (module.config.smtp && module.config.remoteSenderUrl)
  {
    throw new Error('`smtp` and `remoteSenderUrl` cannot be used at the same time!');
  }
  else if (!module.config.smtp && !module.config.remoteSenderUrl && !module.config.emailsPath)
  {
    module.warn('No `smtp`, `remoteSenderUrl` or `emailsPath` specified.');
  }
  else if (module.config.smtp)
  {
    nodemailer = require('nodemailer');
  }
  else if (module.config.remoteSenderUrl)
  {
    request = require('request');
  }

  const transport = module.config.smtp ? nodemailer.createTransport(module.config.smtp) : null;
  const recentlySentFromFile = {};

  app.broker.subscribe('directoryWatcher.changed')
    .setFilter(function(fileInfo) { return /\.email$/.test(fileInfo.fileName); })
    .on('message', sendFromFile);

  setInterval(cleanRecentlySentFromFile, 30 * 60 * 1000);

  /**
   * @param {(string|Array.<string>)} to
   * @param {string} subject
   * @param {string} text
   * @param {function((Error|null), Object)} done
   * @returns {undefined}
   */
  module.send = function(to, subject, text, done)
  {
    let mailOptions;

    if (arguments.length > 2)
    {
      mailOptions = {
        to: to,
        subject: subject,
        text: text
      };
    }
    else
    {
      mailOptions = to;
      done = subject;
    }

    if (_.isEmpty(mailOptions.to))
    {
      module.debug('Not sending e-mail: %s', JSON.stringify(mailOptions));

      return setImmediate(done);
    }

    if (module.config.remoteSenderUrl !== null)
    {
      sendThroughRemote(mailOptions, done);
    }
    else if (transport !== null)
    {
      sendThroughSmtp(mailOptions, done);
    }
    else if (module.config.emailsPath !== null)
    {
      sendThroughFile(mailOptions, done);
    }
    else
    {
      module.debug('Not sending e-mail: %s', JSON.stringify(mailOptions));

      setImmediate(done);
    }
  };

  function sendThroughRemote(body, done)
  {
    const options = {
      url: module.config.remoteSenderUrl,
      method: 'POST',
      json: true,
      body: _.defaults(_.assign(body, {secretKey: module.config.secretKey}), {
        from: module.config.from || undefined,
        bcc: module.config.bcc || undefined,
        replyTo: module.config.replyTo || undefined
      })
    };

    request(options, function(err, res)
    {
      if (err)
      {
        return done(err);
      }

      if (res.statusCode !== 204)
      {
        return done(new Error('INVALID_REMOTE_RESPONSE'));
      }

      return done();
    });
  }

  function sendThroughSmtp(mailOptions, done)
  {
    _.defaults(mailOptions, {
      from: String(module.config.from),
      bcc: String(module.config.bcc),
      replyTo: String(module.config.replyTo)
    });

    transport.sendMail(mailOptions, done);
  }

  function sendThroughFile(mailOptions, done)
  {
    _.defaults(mailOptions, {
      from: String(module.config.from),
      bcc: String(module.config.bcc),
      replyTo: String(module.config.replyTo)
    });

    const email = [];

    _.forEach(['subject', 'to', 'cc', 'bcc', 'from', 'replyTo'], function(header)
    {
      if (!_.isEmpty(mailOptions[header]))
      {
        email.push(header + ': ' + mailOptions[header]);
      }
    });

    const htmlBody = _.isString(mailOptions.html) && !_.isEmpty(mailOptions.html);

    if (htmlBody)
    {
      email.push('html: 1');
    }

    email.push('Body:', mailOptions[htmlBody ? 'html' : 'text'] || '');

    step(
      function openFileStep()
      {
        const emailFileName = (Date.now() + Math.random() * 99999999).toString(36).toUpperCase() + '.email';

        fs.open(path.join(module.config.emailsPath, emailFileName), 'wx+', this.next());
      },
      function writeFileStep(err, fd)
      {
        if (err)
        {
          return this.done(done, err);
        }

        this.fd = fd;

        fs.write(fd, email.join('\r\n'), 0, 'utf8', this.next());
      },
      function closeFileStep(err)
      {
        const fd = this.fd;
        this.fd = null;

        if (err)
        {
          fs.close(fd, function() {});

          return done(err);
        }

        fs.close(fd, done);
      }
    );
  }

  function sendFromFile(fileInfo)
  {
    if (recentlySentFromFile[fileInfo.fileName])
    {
      return;
    }

    recentlySentFromFile[fileInfo.fileName] = Date.now();

    fs.readFile(fileInfo.filePath, 'utf8', function(err, contents)
    {
      if (err)
      {
        return module.error('Failed to read contents of file [%s]: %s', fileInfo.fileName, err.message);
      }

      let bodyIndex = contents.indexOf('Body:');

      if (bodyIndex === -1)
      {
        bodyIndex = contents.indexOf('body:');
      }

      const headers = contents.substring(0, bodyIndex).trim().split('\n');
      const body = contents.substring(bodyIndex + 'Body:'.length).trim();
      const mailOptions = {};

      _.forEach(headers, function(header)
      {
        const colonIndex = header.indexOf(':');
        const headerName = HEADERS[header.substring(0, colonIndex).trim().toLowerCase()];
        const headerValue = header.substring(colonIndex + 1).trim();

        if (headerName)
        {
          mailOptions[headerName] = headerValue;
        }
      });

      if (mailOptions.html)
      {
        mailOptions.html = body;
      }
      else
      {
        mailOptions.text = body;
      }

      module.send(mailOptions, function(err)
      {
        if (err)
        {
          module.error('Failed to send email from file [%s]: %s', fileInfo.fileName, err.message);

          setTimeout(resendFromFile, 60000, fileInfo);
        }
        else
        {
          fs.unlink(fileInfo.filePath, function() {});
        }
      });
    });
  }

  function resendFromFile(fileInfo)
  {
    delete recentlySentFromFile[fileInfo.fileName];

    sendFromFile(fileInfo);
  }

  function cleanRecentlySentFromFile()
  {
    const halfHourAgo = Date.now() - 30 * 60 * 1000;

    _.forEach(recentlySentFromFile, function(sentAt, fileName)
    {
      if (sentAt < halfHourAgo)
      {
        delete recentlySentFromFile[fileName];
      }
    });
  }

  app.onModuleReady(module.config.expressId, function()
  {
    const express = app[module.config.expressId];

    express.options('/mail;send', function(req, res)
    {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
    });

    express.post('/mail;send', function(req, res, next)
    {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Headers', 'Content-Type');

      if (module.config.secretKey !== null && req.body.secretKey !== module.config.secretKey)
      {
        return next(express.createHttpError('INVALID_SECRET_KEY', 401));
      }

      module.send(req.body, function(err)
      {
        if (err)
        {
          module.error('Failed to send e-mail [%s] to [%s]: %s', req.body.subject, req.body.to, err.message);

          return next(err);
        }

        module.debug('Sent e-mail to [%s]: %s', req.body.to, req.body.subject);

        res.sendStatus(204);
      });
    });
  });
};
