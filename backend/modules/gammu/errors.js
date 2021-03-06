// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

exports.TIMEOUT = 114;

exports.list = [
  'NONE',
  'DEVICEOPENERROR',
  'DEVICELOCKED',
  'DEVICENOTEXIST',
  'DEVICEBUSY',
  'DEVICENOPERMISSION',
  'DEVICENODRIVER',
  'DEVICENOTWORK',
  'DEVICEDTRRTSERROR',
  'DEVICECHANGESPEEDERROR',
  'DEVICEWRITEERROR',
  'DEVICEREADERROR',
  'DEVICEPARITYERROR',
  'TIMEOUT',
  'FRAMENOTREQUESTED',
  'UNKNOWNRESPONSE',
  'UNKNOWNFRAME',
  'UNKNOWNCONNECTIONTYPESTRING',
  'UNKNOWNMODELSTRING',
  'SOURCENOTAVAILABLE',
  'NOTSUPPORTED',
  'EMPTY',
  'SECURITYERROR',
  'INVALIDLOCATION',
  'NOTIMPLEMENTED',
  'FULL',
  'UNKNOWN',
  'CANTOPENFILE',
  'MOREMEMORY',
  'PERMISSION',
  'EMPTYSMSC',
  'INSIDEPHONEMENU',
  'NOTCONNECTED',
  'WORKINPROGRESS',
  'PHONEOFF',
  'FILENOTSUPPORTED',
  'BUG',
  'CANCELED',
  'NEEDANOTHERANSWER',
  'OTHERCONNECTIONREQUIRED',
  'WRONGCRC',
  'INVALIDDATETIME',
  'MEMORY',
  'INVALIDDATA',
  'FILEALREADYEXIST',
  'FILENOTEXIST',
  'SHOULDBEFOLDER',
  'SHOULDBEFILE',
  'NOSIM',
  'GNAPPLETWRONG',
  'FOLDERPART',
  'FOLDERNOTEMPTY',
  'DATACONVERTED',
  'UNCONFIGURED',
  'WRONGFOLDER',
  'PHONE_INTERNAL',
  'WRITING_FILE',
  'NONE_SECTION',
  'USING_DEFAULTS',
  'CORRUPTED',
  'BADFEATURE',
  'DISABLED',
  'SPECIFYCHANNEL',
  'NOTRUNNING',
  'NOSERVICE',
  'BUSY',
  'COULDNT_CONNECT',
  'COULDNT_RESOLVE',
  'GETTING_SMSC',
  'ABORTED',
  'INSTALL_NOT_FOUND',
  'READ_ONLY',
  'LAST_VALUE'
];

/**
 * @param {number} exitCode
 * @returns {Error}
 */
exports.fromExitCode = function(exitCode)
{
  return new Error(exports.list[exitCode - 101] || 'E' + exitCode);
};
