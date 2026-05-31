var env = require('../config/env');

var PrismaClient = require('@prisma/client').PrismaClient;

var prisma = new PrismaClient();
var connectionPromise = null;

function connectWithLog() {
  if (connectionPromise) {
    return connectionPromise;
  }

  console.log('[database] Connecting to MongoDB:', maskDatabaseUrl(env.databaseUrl));

  connectionPromise = prisma.$connect()
    .then(function() {
      console.log('[database] MongoDB connected');
    })
    .catch(function(error) {
      connectionPromise = null;
      console.error('[database] MongoDB connection failed:', summarizeConnectionError(error));
    });

  return connectionPromise;
}

function disconnectWithLog() {
  return prisma.$disconnect()
    .then(function() {
      console.log('[database] MongoDB disconnected');
    });
}

function maskDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    return 'DATABASE_URL is not set';
  }

  return databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, function(match, username) {
    return '//' + username + ':****@';
  });
}

function summarizeConnectionError(error) {
  if (/server selection timeout/i.test(error.message || '')) {
    return 'server selection timeout';
  }

  if (/connection refused/i.test(error.message || '')) {
    return 'connection refused';
  }

  return error.message;
}

prisma.connectWithLog = connectWithLog;
prisma.disconnectWithLog = disconnectWithLog;

module.exports = prisma;
