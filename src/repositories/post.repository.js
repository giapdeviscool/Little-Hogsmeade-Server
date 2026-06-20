var prisma = require("../lib/prisma");

function findMany(options) {
  return prisma.post.findMany(options || {});
}

function count(where) {
  return prisma.post.count({ where: where || {} });
}

function findById(id) {
  return prisma.post.findUnique({
    where: { id: id },
  });
}

function findBySlug(slug, excludeId) {
  var where = { slug: slug };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.post.findFirst({ where: where });
}

function create(data) {
  return prisma.post.create({
    data: data,
  });
}

function update(id, data) {
  return prisma.post.update({
    where: { id: id },
    data: data,
  });
}

function remove(id) {
  return prisma.post.delete({
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
