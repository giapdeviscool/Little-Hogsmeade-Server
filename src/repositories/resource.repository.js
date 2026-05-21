var prisma = require('../lib/prisma');

function getDelegate(resource) {
  var delegate = prisma[resource.delegate];

  if (!delegate) {
    var error = new Error('Prisma delegate not found for ' + resource.model);
    error.statusCode = 500;
    throw error;
  }

  return delegate;
}

function findMany(resource, options) {
  return getDelegate(resource).findMany(options || {});
}

function findById(resource, id) {
  return getDelegate(resource).findUnique({
    where: { id: id }
  });
}

function create(resource, data) {
  return getDelegate(resource).create({
    data: data
  });
}

function update(resource, id, data) {
  return getDelegate(resource).update({
    where: { id: id },
    data: data
  });
}

function remove(resource, id) {
  return getDelegate(resource).delete({
    where: { id: id }
  });
}

module.exports = {
  findMany: findMany,
  findById: findById,
  create: create,
  update: update,
  remove: remove
};
