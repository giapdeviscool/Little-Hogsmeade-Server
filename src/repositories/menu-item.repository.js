var prisma = require('../lib/prisma');

async function findMenuItems(filters, skip, take) {
  return prisma.menuItem.findMany({
    where: filters,
    skip: skip,
    take: take,
    orderBy: [
      { category: { displayOrder: 'asc' } },
      { name: 'asc' }
    ],
    include: {
      category: {
        select: {
          name: true,
          displayOrder: true
        }
      }
    }
  });
}

async function countMenuItems(filters) {
  return prisma.menuItem.count({
    where: filters
  });
}

async function findMenuItemByNameAndCategory(name, categoryId) {
  return prisma.menuItem.findFirst({
    where: {
      name: name,
      categoryId: categoryId
    }
  });
}

async function createMenuItem(data) {
  return prisma.menuItem.create({
    data: data
  });
}

module.exports = {
  findMenuItems: findMenuItems,
  countMenuItems: countMenuItems,
  findMenuItemByNameAndCategory: findMenuItemByNameAndCategory,
  createMenuItem: createMenuItem
};
