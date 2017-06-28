'use strict';

module.exports = {
  uri: process.env.HYDRO_MONGODB_URI || 'mongodb://127.0.0.1:27017/walkner-hydro',
  keepAliveQueryInterval: 15000,
  server: {
    poolSize: 10,
    reconnectTries: Number.MAX_SAFE_INTEGER,
    reconnectInterval: 1000,
    socketOptions: {
      autoReconnect: true,
      keepAlive: 1000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 0
    }
  },
  db: {
    w: 1,
    wtimeout: 5000,
    nativeParser: true,
    forceServerObjectId: false
  }
};
