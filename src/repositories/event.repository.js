var prisma = require("../lib/prisma");

function findMany(options) {
  return prisma.event.findMany(options || {});
}

function count(where) {
  return prisma.event.count({ where: where || {} });
}

function findById(id) {
  return prisma.event.findUnique({
    where: { id: id },
  });
}

function create(data) {
  return prisma.event.create({
    data: data,
  });
}

function update(id, data) {
  return prisma.event.update({
    where: { id: id },
    data: data,
  });
}

function remove(id) {
  return prisma.event.delete({
    where: { id: id },
  });
}

module.exports = {
  findMany: findMany,
  count: count,
  findById: findById,
  create: create,
  update: update,
  remove: remove,
};
