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
  var opt = options || {};
  if (resource.name === 'delivery_orders') {
    opt.include = {
      order: {
        include: {
          invoices: true,
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      },
      deliveryEmployee: true
    };
  } else if (resource.name === 'employees') {
    opt.include = {
      role: true,
      branch: true
    };
  }
  return getDelegate(resource).findMany(opt);
}

function findById(resource, id) {
  var query = { where: { id: id } };
  if (resource.name === 'delivery_orders') {
    query.include = {
      order: {
        include: {
          invoices: true,
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      },
      deliveryEmployee: true
    };
  } else if (resource.name === 'employees') {
    query.include = {
      role: true,
      branch: true
    };
  }
  return getDelegate(resource).findUnique(query);
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
