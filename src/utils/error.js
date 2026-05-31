function isDatabaseError(error) {
  if (!error) {
    return false;
  }

  return Boolean(
    error.name === 'PrismaClientKnownRequestError'
    || error.name === 'PrismaClientInitializationError'
    || error.name === 'PrismaClientUnknownRequestError'
    || error.code === 'P1001'
    || error.code === 'P2010'
    || /server selection timeout|connection refused|database server/i.test(error.message || '')
  );
}

function normalizeError(error) {
  if (isDatabaseError(error)) {
    return {
      statusCode: 503,
      payload: {
        message: 'Database service is temporarily unavailable',
        code: 'DATABASE_UNAVAILABLE'
      }
    };
  }

  return {
    statusCode: error.status || error.statusCode || 500,
    payload: {
      message: error.message || 'Internal server error'
    }
  };
}

function logError(error, req) {
  if (isDatabaseError(error)) {
    console.error(
      '[database]',
      req.method,
      req.originalUrl,
      'code=' + (error.code || 'CONNECTION_ERROR'),
      'message=' + getDatabaseLogMessage(error)
    );
    return;
  }

  if ((error.status || error.statusCode || 500) >= 500) {
    console.error('[server]', req.method, req.originalUrl, error.stack || error.message);
  }
}

function getDatabaseLogMessage(error) {
  if (/server selection timeout/i.test(error.message || '')) {
    return 'MongoDB server selection timeout';
  }

  if (/connection refused/i.test(error.message || '')) {
    return 'MongoDB connection refused';
  }

  return 'Database query failed';
}

module.exports = {
  isDatabaseError: isDatabaseError,
  normalizeError: normalizeError,
  logError: logError
};
