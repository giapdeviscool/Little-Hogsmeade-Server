var userRepository = require('../repositories/user.repository');

async function getUsers() {
  var users = await userRepository.findMany();

  return users.map(sanitizeUser);
}

async function getUserById(id) {
  assertValidId(id);

  var user = await userRepository.findById(id);
  if (!user) {
    throwHttpError(404, 'User not found');
  }

  return sanitizeUser(user);
}

async function createUser(payload) {
  var user = await userRepository.create(pickUserPayload(payload));

  return sanitizeUser(user);
}

async function updateUser(id, payload) {
  assertValidId(id);
  await getUserById(id);

  var user = await userRepository.update(id, pickUserPayload(payload));

  return sanitizeUser(user);
}

async function deleteUser(id) {
  assertValidId(id);
  await getUserById(id);

  return userRepository.remove(id);
}

function assertValidId(id) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throwHttpError(400, 'Invalid user id');
  }
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function pickUserPayload(payload) {
  var data = {};

  if (payload.email !== undefined) {
    data.email = normalizeEmail(payload.email);
  }

  if (payload.name !== undefined) {
    data.name = payload.name;
  }

  return data;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email;
}

function sanitizeUser(user) {
  if (!user) {
    return user;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

module.exports = {
  getUsers: getUsers,
  getUserById: getUserById,
  createUser: createUser,
  updateUser: updateUser,
  deleteUser: deleteUser
};
