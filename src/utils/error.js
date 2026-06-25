function isKnownPrismaRequestError(error) {
  return Boolean(error && error.name === 'PrismaClientKnownRequestError');
}

function isUniqueConstraintError(error) {
  return Boolean(isKnownPrismaRequestError(error) && error.code === 'P2002');
}

function isDatabaseError(error) {
  if (!error || isUniqueConstraintError(error)) {
    return false;
  }

  return Boolean(
    error.name === 'PrismaClientInitializationError'
    || error.name === 'PrismaClientUnknownRequestError'
    || error.code === 'P1001'
    || error.code === 'P2010'
    || /server selection timeout|connection refused|database server/i.test(error.message || '')
  );
}

function normalizeError(error) {
  if (isUniqueConstraintError(error)) {
    return {
      statusCode: 409,
      payload: {
        message: 'Resource already exists',
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        target: error.meta && error.meta.target
      }
    };
  }

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
  if (isUniqueConstraintError(error)) {
    console.error(
      '[conflict]',
      req.method,
      req.originalUrl,
      'code=' + error.code,
      'target=' + JSON.stringify(error.meta && error.meta.target)
    );
    return;
  }

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
  isUniqueConstraintError: isUniqueConstraintError,
  normalizeError: normalizeError,
  logError: logError
};
