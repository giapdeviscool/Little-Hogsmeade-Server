var crypto = require('crypto');
var env = require('../config/env');

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString();
}

function verifyJwt(token) {
  var parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  var encodedHeader = parts[0];
  var encodedBody = parts[1];
  var signature = parts[2];
  var expectedSignature = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(encodedHeader + '.' + encodedBody)
    .digest('base64url');

  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  var payload = JSON.parse(decodeBase64Url(encodedBody));
  var now = Math.floor(Date.now() / 1000);

  if (payload.exp < now) {
    throw new Error('Token expired');
  }

  return payload;
}

function decodeJwtPayload(token) {
  var parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  return JSON.parse(decodeBase64Url(parts[1]));
}

module.exports = {
  verifyJwt: verifyJwt,
  decodeJwtPayload: decodeJwtPayload
};
