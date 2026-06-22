var prisma = require("../lib/prisma");

function findMany(options) {
  return prisma.page.findMany(options || {});
}

function count(where) {
  return prisma.page.count({ where: where || {} });
}

function findById(id) {
  return prisma.page.findUnique({
    where: { id: id },
  });
}

function findBySlug(slug, excludeId) {
  var where = { slug: slug };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.page.findFirst({ where: where });
}

function create(data) {
  return prisma.page.create({
    data: data,
  });
}

function update(id, data) {
  return prisma.page.update({
    where: { id: id },
    data: data,
  });
}

function remove(id) {
  return prisma.page.delete({
    where: { id: id },
  });
}

module.exports = {
  findMany: findMany,
  count: count,
  findById: findById,
  findBySlug: findBySlug,
  create: create,
  update: update,
  remove: remove,
};
