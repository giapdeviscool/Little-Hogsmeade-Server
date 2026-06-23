var crypto = require('crypto');
var env = require('../config/env');
var authRepository = require('../repositories/auth.repository');
var jwtUtils = require('../utils/jwt');

var TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

async function register(payload) {
  var accountType = payload.accountType || 'customer';
  var commonData = normalizeCommonData(payload);

  await assertIdentifierAvailable(commonData.phone, commonData.email);

  if (accountType === 'employee') {
    return registerEmployee(payload, commonData);
  }

  return registerCustomer(payload, commonData);
}

async function login(payload) {
  var identifier = normalizeIdentifier(payload.identifier || payload.email || payload.phone);
  var account = await findAccountByIdentifier(identifier);

  if (!account || !account.record.passwordHash || !verifyPassword(payload.password, account.record.passwordHash)) {
    throwHttpError(401, 'Invalid identifier or password');
  }

  return createAuthResponse(account.type, account.record);
}

async function registerCustomer(payload, commonData) {
  var customer = await authRepository.createCustomer({
    phone: commonData.phone,
    fullName: commonData.fullName,
    email: commonData.email,
    avatarUrl: commonData.avatarUrl,
    birthday: parseOptionalDate(payload.birthday, 'birthday'),
    source: payload.source || 'online-register',
    passwordHash: hashPassword(payload.password)
  });

  return createAuthResponse('customer', customer);
}

async function registerEmployee(payload, commonData) {
  assertValidObjectId(payload.branchId, 'branchId');
  assertValidObjectId(payload.roleId, 'roleId');
  assertRequiredString(payload.pinCode, 'pinCode');

  var employee = await authRepository.createEmployee({
    branchId: payload.branchId,
    roleId: payload.roleId,
    fullName: commonData.fullName,
    phone: commonData.phone,
    email: commonData.email,
    avatarUrl: commonData.avatarUrl,
    hiredDate: parseOptionalDate(payload.hiredDate, 'hiredDate') || new Date(),
    pinCode: payload.pinCode,
    passwordHash: hashPassword(payload.password)
  });

  return createAuthResponse('employee', employee);
}

async function assertIdentifierAvailable(phone, email) {
  var existingByPhone = await authRepository.findCustomerByPhone(phone)
    || await authRepository.findEmployeeByPhone(phone);

  if (existingByPhone) {
    throwHttpError(409, 'Phone already registered');
  }

  if (!email) {
    return;
  }

  var existingByEmail = await authRepository.findCustomerByEmail(email)
    || await authRepository.findEmployeeByEmail(email);

  if (existingByEmail) {
    throwHttpError(409, 'Email already registered');
  }
}

async function findAccountByIdentifier(identifier) {
  var lookupByEmail = identifier.indexOf('@') > -1;
  var customer = lookupByEmail
    ? await authRepository.findCustomerByEmail(identifier)
    : await authRepository.findCustomerByPhone(identifier);

  if (customer) {
    return {
      type: 'customer',
      record: customer
    };
  }

  var employee = lookupByEmail
    ? await authRepository.findEmployeeByEmail(identifier)
    : await authRepository.findEmployeeByPhone(identifier);

  if (employee) {
    return {
      type: 'employee',
      record: employee
    };
  }

  return null;
}

function createAuthResponse(accountType, account) {
  var roleName = account.role ? account.role.name : null;

  return {
    accountType: accountType,
    user: sanitizeAccount(accountType, account),
    token: signToken({
      sub: account.id,
      type: accountType,
      phone: account.phone,
      email: account.email || null,
      branchId: account.branchId || null,
      roleId: account.roleId || null,
      roleName: roleName
    })
  };
}

function normalizeCommonData(payload) {
  return {
    fullName: payload.fullName.trim(),
    phone: payload.phone.trim(),
    email: payload.email ? payload.email.trim().toLowerCase() : null,
    avatarUrl: payload.avatarUrl || null
  };
}

function normalizeIdentifier(identifier) {
  return identifier.trim().toLowerCase();
}

function parseOptionalDate(value, fieldName) {
  if (!value) {
    return null;
  }

  var date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throwHttpError(400, fieldName + ' must be a valid ISO date string');
  }

  return date;
}

function assertRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throwHttpError(400, fieldName + ' is required');
  }
}

function assertValidObjectId(value, fieldName) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throwHttpError(400, fieldName + ' must be a valid ObjectId');
  }
}

function sanitizeAccount(accountType, account) {
  var base = {
    id: account.id,
    accountType: accountType,
    fullName: account.fullName,
    phone: account.phone,
    email: account.email || null,
    avatarUrl: account.avatarUrl || null
  };

  if (accountType === 'employee') {
    base.branchId = account.branchId;
    base.roleId = account.roleId;
    base.roleName = account.role ? account.role.name : null;
    base.status = account.status;
  } else {
    base.birthday = account.birthday;
    base.source = account.source;
  }

  return base;
}

function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(password, salt, 64).toString('hex');
  log('Password hashed:', { salt: salt, hash: hash }); // Debug log
  return salt + ':' + hash;
}

function verifyPassword(password, passwordHash) {
  var parts = passwordHash.split(':');

  if (parts.length !== 2) {
    return false;
  }

  var salt = parts[0];
  var storedHash = Buffer.from(parts[1], 'hex');
  var hash = crypto.scryptSync(password, salt, 64);

  return storedHash.length === hash.length && crypto.timingSafeEqual(storedHash, hash);
}

function signToken(payload) {
  var now = Math.floor(Date.now() / 1000);
  var header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  var body = Object.assign({}, payload, {
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  });
  var encodedHeader = base64Url(JSON.stringify(header));
  var encodedBody = base64Url(JSON.stringify(body));
  var signature = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(encodedHeader + '.' + encodedBody)
    .digest('base64url');

  return encodedHeader + '.' + encodedBody + '.' + signature;
}

function verifyToken(token) {
  return jwtUtils.verifyJwt(token);
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  register: register,
  login: login,
  verifyToken: verifyToken
};
