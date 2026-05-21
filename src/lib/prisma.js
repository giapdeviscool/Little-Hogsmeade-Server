var env = require('../config/env');

var PrismaClient = require('@prisma/client').PrismaClient;

var prisma = new PrismaClient();
var connectionPromise = null;

function connectWithLog() {
  if (connectionPromise) {
    return connectionPromise;
  }

  console.log('[prisma] Connecting to MongoDB:', maskDatabaseUrl(env.databaseUrl));

  connectionPromise = prisma.$connect()
    .then(function() {
      console.log('[prisma] MongoDB connected');
    })
    .catch(function(error) {
      connectionPromise = null;
      console.error('[prisma] MongoDB connection failed:', error.message);
    });

  return connectionPromise;
}

function disconnectWithLog() {
  return prisma.$disconnect()
    .then(function() {
      console.log('[prisma] MongoDB disconnected');
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

prisma.connectWithLog = connectWithLog;
prisma.disconnectWithLog = disconnectWithLog;

module.exports = prisma;
