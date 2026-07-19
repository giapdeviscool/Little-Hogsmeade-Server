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
  return prisma.$transaction(async function (tx) {
    var existingItems = await tx.menuItem.findMany({
      where: { branchId: branch.id },
      select: { id: true }
    });
    var itemIds = existingItems.map(function (item) {
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

      // Categories are global — no longer copy per branch
    // Just copy menu items with their original categoryId

    for (var j = 0; j < menuItems.length; j += 1) {
      var sourceItem = menuItems[j];

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


function findBranchMenuItems(branchId) {
  return prisma.branchMenuItem.findMany({
    where: { branchId: branchId },
    include: {
      menuItem: {
        include: {
          menuItemVariants: true,
          menuItemToppingGroups: {
            include: {
              toppingGroup: {
                include: {
                  toppings: {
                    where: { isActive: true },
                  },
                },
              },
            },
          },
        },
      },
    }
  });
}

function upsertBranchMenuItems(branchId, entries) {
  return prisma.$transaction(async function (tx) {
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

function replaceBranchJunctionMenu(branchId, menuItemEntries) {
  return prisma.$transaction(async function (tx) {
    await tx.branchMenuItem.deleteMany({
      where: { branchId: branchId }
    });

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

    return { menuItems: menuItemEntries.length };
  });
}

function findBranchSpecificMenuItems(branchId) {
  return prisma.menuItem.findMany({
    where: { branchId: branchId },
    include: {
      menuItemVariants: true,
      menuItemToppingGroups: {
        include: {
          toppingGroup: {
            include: {
              toppings: {
                where: { isActive: true },
              },
            },
          },
        },
      },
    },
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
  createVoucher: createVoucher,
  findVouchers: findVouchers,
  countVouchers: countVouchers,
  findVoucherById: findVoucherById,
  updateVoucher: updateVoucher,
  deleteVoucher: deleteVoucher,
  upsertBranchMenuItems: upsertBranchMenuItems,
  findBranchMenuItems: findBranchMenuItems,
  replaceBranchJunctionMenu: replaceBranchJunctionMenu,
  findBranchSpecificMenuItems: findBranchSpecificMenuItems
};
