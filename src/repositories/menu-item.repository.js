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
      },
      _count: {
        select: {
          menuItemToppingGroups: true
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

async function findMenuItemById(id) {
  return prisma.menuItem.findUnique({
    where: { id: id }
  });
}

async function countRecipesForMenuItem(menuItemId) {
  return prisma.recipe.count({
    where: { menuItemId: menuItemId }
  });
}

async function updateMenuItemStatus(id, isActive) {
  return prisma.menuItem.update({
    where: { id: id },
    data: { isActive: isActive }
  });
}

async function findCurrentToppingGroupAssignments(menuItemId) {
  return prisma.menuItemToppingGroup.findMany({
    where: { menuItemId: menuItemId },
    select: { toppingGroupId: true }
  });
}

async function assignToppingGroups(menuItemId, toppingGroupIds) {
  var data = toppingGroupIds.map(function(id) {
    return {
      menuItemId: menuItemId,
      toppingGroupId: id
    };
  });
  return prisma.menuItemToppingGroup.createMany({
    data: data
  });
}

async function removeToppingGroupAssignments(menuItemId, toppingGroupIds) {
  return prisma.menuItemToppingGroup.deleteMany({
    where: {
      menuItemId: menuItemId,
      toppingGroupId: { in: toppingGroupIds }
    }
  });
}

module.exports = {
  findMenuItems: findMenuItems,
  countMenuItems: countMenuItems,
  findMenuItemByNameAndCategory: findMenuItemByNameAndCategory,
  createMenuItem: createMenuItem,
  findMenuItemById: findMenuItemById,
  countRecipesForMenuItem: countRecipesForMenuItem,
  updateMenuItemStatus: updateMenuItemStatus,
  findCurrentToppingGroupAssignments: findCurrentToppingGroupAssignments,
  assignToppingGroups: assignToppingGroups,
  removeToppingGroupAssignments: removeToppingGroupAssignments
};
