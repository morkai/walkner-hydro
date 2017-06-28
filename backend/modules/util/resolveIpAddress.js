// Part of <https://miracle.systems/p/walkner-wmes> licensed under <CC BY-NC-SA 4.0>

'use strict';

module.exports = function resolveIpAddress(addressData)
{
  var ip = '';

  if (addressData)
  {
    if (hasRealIpFromProxyServer(addressData))
    {
      ip = (addressData.headers || addressData.request.headers)['x-real-ip'];
    }
    // HTTP
    else if (addressData.socket && typeof addressData.socket.remoteAddress === 'string')
    {
      ip = addressData.socket.remoteAddress;
    }
    // Socket.IO
    else if (addressData.conn && typeof addressData.conn.remoteAddress === 'string')
    {
      ip = addressData.conn.remoteAddress;
    }
    else if (typeof addressData.address === 'string')
    {
      ip = addressData.address;
    }
  }

  return ip;
};

function hasRealIpFromProxyServer(addressData)
{
  var handshake = addressData.request;
  var headers = handshake ? handshake.headers : addressData.headers;

  if (!headers || typeof headers['x-real-ip'] !== 'string')
  {
    return false;
  }

  // HTTP
  if (addressData.socket && addressData.socket.remoteAddress === '127.0.0.1')
  {
    return true;
  }

  // Socket.IO
  return addressData.conn && addressData.conn.remoteAddress === '127.0.0.1';
}
