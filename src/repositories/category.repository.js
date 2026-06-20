var prisma = require('../lib/prisma');

async function findCategories(filters, skip, take) {
  return prisma.category.findMany({
    where: filters,
    skip: skip,
    take: take,
    orderBy: [
      { displayOrder: 'asc' },
      { name: 'asc' }
    ],
    include: {
      _count: {
        select: { menuItems: true }
      }
    }
  });
}

async function countCategories(filters) {
  return prisma.category.count({
    where: filters
  });
}

async function findCategoryByName(name, branchId, excludeId) {
  var where = {
    name: {
      equals: name,
      mode: 'insensitive'
    }
  };
  if (branchId !== undefined) {
    where.branchId = branchId;
  }
  if (excludeId) {
    where.id = { not: excludeId };
  }
  return prisma.category.findFirst({ where: where });
}

async function findCategoryById(id) {
  return prisma.category.findUnique({
    where: { id: id },
    include: {
      _count: {
        select: { menuItems: { where: { isActive: true } } }
      }
    }
  });
}

async function createCategory(data) {
  return prisma.category.create({
    data: data
  });
}

async function updateCategory(id, data) {
  return prisma.category.update({
    where: { id: id },
    data: data
  });
}

module.exports = {
  findCategories: findCategories,
  countCategories: countCategories,
  findCategoryByName: findCategoryByName,
  findCategoryById: findCategoryById,
  createCategory: createCategory,
  updateCategory: updateCategory
};
