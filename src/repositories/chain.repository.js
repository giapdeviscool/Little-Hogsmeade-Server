var prisma = require('../lib/prisma');

function getLatestConfig() {
  return prisma.chainConfig.findFirst({
    orderBy: { createdAt: 'desc' }
  });
}

function createConfig(data) {
  return prisma.chainConfig.create({ data: data });
}

function updateConfig(id, data) {
  return prisma.chainConfig.update({
    where: { id: id },
    data: data
  });
}

function findInvoices(where) {
  return prisma.invoice.findMany({
    where: where,
    include: {
      order: {
        include: {
          branch: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });
}

function countOrders(where) {
  return prisma.order.count({ where: where });
}

function sumExpenses(where) {
  return prisma.expense.aggregate({
    where: where,
    _sum: { amount: true }
  });
}

function sumExpensesByBranch(where) {
  return prisma.expense.groupBy({
    by: ['branchId'],
    where: where,
    _sum: { amount: true }
  });
}

function findStandardCategories() {
  return prisma.category.findMany({
    where: { branchId: null },
    orderBy: { displayOrder: 'asc' }
  });
}

function findStandardMenuItems() {
  return prisma.menuItem.findMany({
    where: { branchId: null },
    include: {
      menuItemVariants: true
    },
    orderBy: { name: 'asc' }
  });
}

function findActiveBranches() {
  return prisma.branch.findMany({
    where: { status: 'active' },
    orderBy: { name: 'asc' }
  });
}

function replaceBranchMenu(branch, categories, menuItems) {
  return prisma.$transaction(async function(tx) {
    var existingItems = await tx.menuItem.findMany({
      where: { branchId: branch.id },
      select: { id: true }
    });
    var itemIds = existingItems.map(function(item) {
      return item.id;
    });

    if (itemIds.length > 0) {
      await tx.menuItemVariant.deleteMany({
        where: { menuItemId: { in: itemIds } }
      });
      await tx.menuItemToppingGroup.deleteMany({
        where: { menuItemId: { in: itemIds } }
      });
      await tx.recipe.deleteMany({
        where: { menuItemId: { in: itemIds } }
      });
      await tx.menuItem.deleteMany({
        where: { id: { in: itemIds } }
      });
    }

    await tx.category.deleteMany({
      where: { branchId: branch.id }
    });

    var categoryIdMap = {};

    for (var i = 0; i < categories.length; i += 1) {
      var category = await tx.category.create({
        data: {
          branchId: branch.id,
          name: categories[i].name,
          icon: categories[i].icon,
          displayOrder: categories[i].displayOrder,
          isActive: categories[i].isActive
        }
      });

      categoryIdMap[categories[i].id] = category.id;
    }

    for (var j = 0; j < menuItems.length; j += 1) {
      var sourceItem = menuItems[j];
      var categoryId = categoryIdMap[sourceItem.categoryId];

      if (!categoryId) {
        continue;
      }

      var menuItem = await tx.menuItem.create({
        data: {
          branchId: branch.id,
          categoryId: categoryId,
          name: sourceItem.name,
          description: sourceItem.description,
          imageUrl: sourceItem.imageUrl,
          basePrice: sourceItem.basePrice,
          isActive: sourceItem.isActive,
          isFeatured: sourceItem.isFeatured,
          itemType: sourceItem.itemType
        }
      });

      for (var k = 0; k < sourceItem.menuItemVariants.length; k += 1) {
        await tx.menuItemVariant.create({
          data: {
            menuItemId: menuItem.id,
            name: sourceItem.menuItemVariants[k].name,
            priceAdjustment: sourceItem.menuItemVariants[k].priceAdjustment
          }
        });
      }
    }

    return branch.id;
  });
}

function updateStandardMenuItemPrice(id, basePrice) {
  return prisma.menuItem.update({
    where: { id: id },
    data: { basePrice: basePrice }
  });
}

function updateBranchMenuItemPrices(name, basePrice, branchIds) {
  return prisma.menuItem.updateMany({
    where: {
      name: name,
      branchId: { in: branchIds }
    },
    data: {
      basePrice: basePrice
    }
  });
}

function createVoucher(data) {
  return prisma.voucher.create({ data: data });
}

function findVouchers(options) {
  var defaultOptions = { orderBy: { startDate: 'desc' } };
  return prisma.voucher.findMany(options ? Object.assign({}, defaultOptions, options) : defaultOptions);
}

function countVouchers(where) {
  return prisma.voucher.count({ where: where || {} });
}

function findVoucherById(id) {
  return prisma.voucher.findUnique({
    where: { id: id }
  });
}

function updateVoucher(id, data) {
  return prisma.voucher.update({
    where: { id: id },
    data: data
  });
}

function deleteVoucher(id) {
  return prisma.voucher.delete({
    where: { id: id }
  });
}

// ===================== Branch Menu Junctions =====================

function findBranchCategories(branchId) {
  return prisma.branchCategory.findMany({
    where: { branchId: branchId },
    include: { category: true }
  });
}

function upsertBranchCategories(branchId, entries) {
  return prisma.$transaction(async function(tx) {
    await tx.branchCategory.deleteMany({
      where: { branchId: branchId }
    });

    for (var i = 0; i < entries.length; i += 1) {
      await tx.branchCategory.create({
        data: {
          branchId: branchId,
          categoryId: entries[i].categoryId,
          isActive: entries[i].isActive !== undefined ? entries[i].isActive : true,
          displayOrder: entries[i].displayOrder !== undefined ? entries[i].displayOrder : null
        }
      });
    }

    return entries.length;
  });
}

function findBranchMenuItems(branchId) {
  return prisma.branchMenuItem.findMany({
    where: { branchId: branchId },
    include: { menuItem: true }
  });
}

function upsertBranchMenuItems(branchId, entries) {
  return prisma.$transaction(async function(tx) {
    await tx.branchMenuItem.deleteMany({
      where: { branchId: branchId }
    });

    for (var i = 0; i < entries.length; i += 1) {
      await tx.branchMenuItem.create({
        data: {
          branchId: branchId,
          menuItemId: entries[i].menuItemId,
          isActive: entries[i].isActive !== undefined ? entries[i].isActive : true,
          basePrice: entries[i].basePrice !== undefined ? entries[i].basePrice : null
        }
      });
    }

    return entries.length;
  });
}

function replaceBranchJunctionMenu(branchId, categoryEntries, menuItemEntries) {
  return prisma.$transaction(async function(tx) {
    await tx.branchMenuItem.deleteMany({
      where: { branchId: branchId }
    });

    await tx.branchCategory.deleteMany({
      where: { branchId: branchId }
    });

    for (var i = 0; i < categoryEntries.length; i += 1) {
      await tx.branchCategory.create({
        data: {
          branchId: branchId,
          categoryId: categoryEntries[i].categoryId,
          isActive: categoryEntries[i].isActive !== undefined ? categoryEntries[i].isActive : true,
          displayOrder: categoryEntries[i].displayOrder !== undefined ? categoryEntries[i].displayOrder : null
        }
      });
    }

    for (var j = 0; j < menuItemEntries.length; j += 1) {
      await tx.branchMenuItem.create({
        data: {
          branchId: branchId,
          menuItemId: menuItemEntries[j].menuItemId,
          isActive: menuItemEntries[j].isActive !== undefined ? menuItemEntries[j].isActive : true,
          basePrice: menuItemEntries[j].basePrice !== undefined ? menuItemEntries[j].basePrice : null
        }
      });
    }

    return { categories: categoryEntries.length, menuItems: menuItemEntries.length };
  });
}

function findBranchSpecificCategories(branchId) {
  return prisma.category.findMany({
    where: { branchId: branchId, isActive: true },
    orderBy: { displayOrder: 'asc' }
  });
}

function findBranchSpecificMenuItems(branchId) {
  return prisma.menuItem.findMany({
    where: { branchId: branchId, isActive: true },
    include: { menuItemVariants: true }
  });
}

module.exports = {
  getLatestConfig: getLatestConfig,
  createConfig: createConfig,
  updateConfig: updateConfig,
  findInvoices: findInvoices,
  countOrders: countOrders,
  sumExpenses: sumExpenses,
  sumExpensesByBranch: sumExpensesByBranch,
  findStandardCategories: findStandardCategories,
  findStandardMenuItems: findStandardMenuItems,
  findActiveBranches: findActiveBranches,
  replaceBranchMenu: replaceBranchMenu,
  updateStandardMenuItemPrice: updateStandardMenuItemPrice,
  updateBranchMenuItemPrices: updateBranchMenuItemPrices,
  findBranchCategories: findBranchCategories,
  upsertBranchCategories: upsertBranchCategories,
  findBranchMenuItems: findBranchMenuItems,
  upsertBranchMenuItems: upsertBranchMenuItems,
  replaceBranchJunctionMenu: replaceBranchJunctionMenu,
  findBranchSpecificCategories: findBranchSpecificCategories,
  findBranchSpecificMenuItems: findBranchSpecificMenuItems,
  createVoucher: createVoucher,
  findVouchers: findVouchers,
  countVouchers: countVouchers,
  findVoucherById: findVoucherById,
  updateVoucher: updateVoucher,
  deleteVoucher: deleteVoucher
};
