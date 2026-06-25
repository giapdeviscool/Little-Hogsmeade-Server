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

function createCampaign(data) {
  return prisma.campaign.create({ data: data });
}

function findCampaigns(options) {
  var defaultOptions = { orderBy: { startDate: 'desc' } };
  return prisma.campaign.findMany(options ? Object.assign({}, defaultOptions, options) : defaultOptions);
}

function countCampaigns(where) {
  return prisma.campaign.count({ where: where || {} });
}

function findCampaignById(id) {
  return prisma.campaign.findUnique({
    where: { id: id }
  });
}

function updateCampaign(id, data) {
  return prisma.campaign.update({
    where: { id: id },
    data: data
  });
}

function deleteCampaign(id) {
  return prisma.campaign.delete({
    where: { id: id }
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
  createCampaign: createCampaign,
  findCampaigns: findCampaigns,
  countCampaigns: countCampaigns,
  findCampaignById: findCampaignById,
  updateCampaign: updateCampaign,
  deleteCampaign: deleteCampaign
};
