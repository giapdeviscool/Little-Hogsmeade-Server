var prisma = require("../lib/prisma");

function findMany(options) {
  return prisma.banner.findMany(options || {});
}

function count(where) {
  return prisma.banner.count({ where: where || {} });
}

function findById(id) {
  return prisma.banner.findUnique({
    where: { id: id },
  });
}

function create(data) {
  return prisma.banner.create({
    data: data,
  });
}

function update(id, data) {
  return prisma.banner.update({
    where: { id: id },
    data: data,
  });
}

function remove(id) {
  return prisma.banner.delete({
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
