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

async function findCategoryByName(name, _branchId, excludeId) {
  var where = {
    name: {
      equals: name,
      mode: 'insensitive'
    }
  };
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

async function swapDisplayOrder(categoryId, direction) {
  var category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return null;

  var neighbor;

  if (direction === 'up') {
    neighbor = await prisma.category.findFirst({
      where: { displayOrder: { lt: category.displayOrder } },
      orderBy: { displayOrder: 'desc' }
    });
  } else {
    neighbor = await prisma.category.findFirst({
      where: { displayOrder: { gt: category.displayOrder } },
      orderBy: { displayOrder: 'asc' }
    });
  }

  if (!neighbor) return category;

  await prisma.$transaction([
    prisma.category.update({ where: { id: category.id }, data: { displayOrder: neighbor.displayOrder } }),
    prisma.category.update({ where: { id: neighbor.id }, data: { displayOrder: category.displayOrder } })
  ]);

  return category;
}

module.exports = {
  findCategories: findCategories,
  countCategories: countCategories,
  findCategoryByName: findCategoryByName,
  findCategoryById: findCategoryById,
  createCategory: createCategory,
  updateCategory: updateCategory,
  swapDisplayOrder: swapDisplayOrder
};
