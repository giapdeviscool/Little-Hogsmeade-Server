var prisma = require('../lib/prisma');

async function findToppingGroups(branchId) {
  var filters = { isActive: true };
  if (branchId) {
    filters.OR = [
      { branchId: null },
      { branchId: branchId }
    ];
  } else {
    filters.branchId = null;
  }

  return prisma.toppingGroup.findMany({
    where: filters,
    include: {
      toppings: {
        where: { isActive: true }
      }
    }
  });
}

async function createToppingGroup(data) {
  return prisma.toppingGroup.create({
    data: data,
    include: {
      toppings: true
    }
  });
}

async function updateToppingGroup(id, data) {
  return prisma.toppingGroup.update({
    where: { id: id },
    data: data,
    include: {
      toppings: true
    }
  });
}

async function countMenuItemToppingGroups(toppingGroupId) {
  return prisma.menuItemToppingGroup.count({
    where: { toppingGroupId: toppingGroupId }
  });
}

async function softDeleteToppingGroup(id) {
  return prisma.toppingGroup.update({
    where: { id: id },
    data: { isActive: false }
  });
}

async function softDeleteTopping(id) {
  return prisma.topping.update({
    where: { id: id },
    data: { isActive: false }
  });
}

async function findToppingGroupById(id) {
  return prisma.toppingGroup.findUnique({
    where: { id: id },
    include: { toppings: true }
  });
}

module.exports = {
  findToppingGroups: findToppingGroups,
  createToppingGroup: createToppingGroup,
  updateToppingGroup: updateToppingGroup,
  softDeleteToppingGroup: softDeleteToppingGroup,
  softDeleteTopping: softDeleteTopping,
  findToppingGroupById: findToppingGroupById,
  countMenuItemToppingGroups: countMenuItemToppingGroups
};
