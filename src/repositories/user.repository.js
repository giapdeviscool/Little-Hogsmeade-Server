var prisma = require('../lib/prisma');

function findMany() {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' }
  });
}

function findById(id) {
  return prisma.user.findUnique({
    where: { id: id }
  });
}

function findByEmail(email) {
  return prisma.user.findUnique({
    where: { email: email }
  });
}

function create(data) {
  return prisma.user.create({
    data: data
  });
}

function update(id, data) {
  return prisma.user.update({
    where: { id: id },
    data: data
  });
}

function remove(id) {
  return prisma.user.delete({
    where: { id: id }
  });
}

module.exports = {
  findMany: findMany,
  findById: findById,
  findByEmail: findByEmail,
  create: create,
  update: update,
  remove: remove
};
