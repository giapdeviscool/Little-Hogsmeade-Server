var branchRepository = require('../repositories/branch.repository');
var chainRepository = require('../repositories/chain.repository');
var authMiddleware = require('../middlewares/auth.middleware');

async function getDashboard(query) {
  var dateRange = parseDateRange(query.startDate, query.endDate);
  var branchId = query.branchId || null;
  var branchWhere = {};
  var invoiceWhere = {
    createdAt: {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    },
    status: { in: ['paid', 'Paid', 'completed', 'Completed'] },
    order: {}
  };
  var orderWhere = {
    createdAt: {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  };
  var expenseWhere = {
    date: {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  };

  if (branchId) {
    assertValidObjectId(branchId, 'branchId');
    branchWhere.branchId = branchId;
    invoiceWhere.order.branchId = branchId;
    orderWhere.branchId = branchId;
    expenseWhere.branchId = branchId;
  }

  var invoices = await chainRepository.findInvoices(invoiceWhere);
  var totalOrders = await chainRepository.countOrders(orderWhere);
  var expenseResult = await chainRepository.sumExpenses(expenseWhere);
  var totalRevenue = sumInvoices(invoices);
  var totalExpenses = expenseResult._sum.amount || 0;
  var grossProfit = totalRevenue - totalExpenses;

  return {
    filters: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      branchId: branchId
    },
    kpis: {
      totalRevenue: totalRevenue,
      totalOrders: totalOrders,
      grossProfit: grossProfit
    },
    revenueSeries: buildRevenueSeries(invoices),
    branchPerformance: buildBranchPerformance(invoices)
  };
}

async function getConfig() {
  var config = await chainRepository.getLatestConfig();

  if (config) {
    return config;
  }

  return chainRepository.createConfig({});
}

async function updateConfig(payload) {
  var config = await getConfig();
  var data = {};

  if (payload.loyaltyEarnRate !== undefined) {
    data.loyaltyEarnRate = parseNonNegativeNumber(payload.loyaltyEarnRate, 'loyaltyEarnRate');
  }

  if (payload.globalPricingEnabled !== undefined) {
    data.globalPricingEnabled = Boolean(payload.globalPricingEnabled);
  }

  if (payload.defaultCurrency !== undefined) {
    if (typeof payload.defaultCurrency !== 'string' || payload.defaultCurrency.trim() === '') {
      throwHttpError(400, 'defaultCurrency must be a non-empty string');
    }

    data.defaultCurrency = payload.defaultCurrency.trim().toUpperCase();
  }

  return chainRepository.updateConfig(config.id, data);
}

async function syncMenu() {
  var categories = await chainRepository.findStandardCategories();
  var menuItems = await chainRepository.findStandardMenuItems();
  var branches = await chainRepository.findActiveBranches();
  var syncedBranchIds = [];

  for (var i = 0; i < branches.length; i += 1) {
    var branchId = await chainRepository.replaceBranchMenu(branches[i], categories, menuItems);
    syncedBranchIds.push(branchId);
  }

  return {
    syncedBranches: syncedBranchIds.length,
    syncedBranchIds: syncedBranchIds,
    standardCategories: categories.length,
    standardMenuItems: menuItems.length
  };
}

async function updatePricing(payload, user) {
  var itemId = payload.menuItemId;
  var basePrice = parseNonNegativeNumber(payload.basePrice, 'basePrice');
  var targetBranchIds = Array.isArray(payload.branchIds) ? payload.branchIds : [];

  assertValidObjectId(itemId, 'menuItemId');

  for (var i = 0; i < targetBranchIds.length; i += 1) {
    assertValidObjectId(targetBranchIds[i], 'branchId');
  }

  var standardItem = await chainRepository.updateStandardMenuItemPrice(itemId, basePrice);

  if (!authMiddleware.isOwner(user)) {
    await assertLocalPricingAllowed(user.branchId);
    targetBranchIds = [user.branchId];
  }

  var branches = targetBranchIds.length > 0
    ? await branchRepository.findAll({ where: { id: { in: targetBranchIds }, status: 'active' } })
    : await branchRepository.findAll({ where: { status: 'active' } });
  var activeBranchIds = branches.map(function(branch) {
    return branch.id;
  });
  var updatedBranches = await chainRepository.updateBranchMenuItemPrices(standardItem.name, basePrice, activeBranchIds);

  return {
    menuItem: standardItem,
    updatedBranchItems: updatedBranches.count,
    targetBranches: activeBranchIds.length
  };
}

async function createPromotion(payload) {
  var data = normalizePromotionPayload(payload);

  return chainRepository.createCampaign(data);
}

async function getPromotions() {
  return chainRepository.findCampaigns();
}

async function updatePromotion(id, payload) {
  var data = normalizePromotionPayload(payload);
  return chainRepository.updateCampaign(id, data);
}

async function deletePromotion(id) {
  return chainRepository.deleteCampaign(id);
}

async function getMenuSyncPreview() {
  var categories = await chainRepository.findStandardCategories();
  var menuItems = await chainRepository.findStandardMenuItems();

  return {
    categories: categories,
    menuItems: menuItems
  };
}

async function assertLocalPricingAllowed(branchId) {
  if (!branchId) {
    throwHttpError(403, 'Chain Admin must be assigned to a branch to update local pricing');
  }

  var branch = await branchRepository.findById(branchId);

  if (!branch || !branch.allowLocalPricingOverride) {
    throwHttpError(403, 'Local pricing override is disabled for this branch');
  }
}

function normalizePromotionPayload(payload) {
  var startDate = parseDate(payload.startDate, 'startDate');
  var endDate = parseDate(payload.endDate, 'endDate');
  var scope = String(payload.scope || 'global').trim().toLowerCase();
  var appliedBranches = Array.isArray(payload.appliedBranches) ? payload.appliedBranches : [];

  if (endDate <= startDate) {
    throwHttpError(400, 'endDate must be greater than startDate');
  }

  if (scope !== 'global' && scope !== 'specific') {
    throwHttpError(400, 'scope must be global or specific');
  }

  for (var i = 0; i < appliedBranches.length; i += 1) {
    assertValidObjectId(appliedBranches[i], 'appliedBranches');
  }

  return {
    branchId: scope === 'specific' && appliedBranches.length === 1 ? appliedBranches[0] : null,
    name: assertNonEmptyString(payload.name, 'name'),
    description: payload.description ? String(payload.description).trim() : null,
    startDate: startDate,
    endDate: endDate,
    discountValue: parseNonNegativeNumber(payload.discountValue, 'discountValue'),
    discountType: normalizeDiscountType(payload.discountType),
    scope: scope,
    appliedBranches: scope === 'global' ? [] : appliedBranches,
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive)
  };
}

function parseDateRange(startDateValue, endDateValue) {
  var endDate = endDateValue ? parseDate(endDateValue, 'endDate') : new Date();
  var startDate = startDateValue ? parseDate(startDateValue, 'startDate') : new Date(endDate);

  if (!startDateValue) {
    startDate.setDate(startDate.getDate() - 30);
  }

  if (endDate < startDate) {
    throwHttpError(400, 'endDate must be greater than or equal to startDate');
  }

  return {
    startDate: startDate,
    endDate: endDate
  };
}

function buildRevenueSeries(invoices) {
  var buckets = {};

  invoices.forEach(function(invoice) {
    var key = invoice.createdAt.toISOString().slice(0, 10);
    buckets[key] = (buckets[key] || 0) + invoice.totalAmount;
  });

  return Object.keys(buckets).sort().map(function(date) {
    return {
      date: date,
      revenue: buckets[date]
    };
  });
}

function buildBranchPerformance(invoices) {
  var buckets = {};

  invoices.forEach(function(invoice) {
    var branch = invoice.order && invoice.order.branch;
    var branchId = branch ? branch.id : 'unknown';

    if (!buckets[branchId]) {
      buckets[branchId] = {
        branchId: branchId,
        branchName: branch ? branch.name : 'Unknown branch',
        revenue: 0,
        orders: 0
      };
    }

    buckets[branchId].revenue += invoice.totalAmount;
    buckets[branchId].orders += 1;
  });

  return Object.keys(buckets).map(function(branchId) {
    return buckets[branchId];
  }).sort(function(a, b) {
    return b.revenue - a.revenue;
  });
}

function sumInvoices(invoices) {
  return invoices.reduce(function(total, invoice) {
    return total + invoice.totalAmount;
  }, 0);
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throwHttpError(400, field + ' must be a non-empty string');
  }

  return value.trim();
}

function normalizeDiscountType(value) {
  var discountType = String(value || 'percent').trim().toLowerCase();

  if (discountType !== 'percent' && discountType !== 'fixed') {
    throwHttpError(400, 'discountType must be percent or fixed');
  }

  return discountType;
}

function parseNonNegativeNumber(value, field) {
  var number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throwHttpError(400, field + ' must be a non-negative number');
  }

  return number;
}

function parseDate(value, field) {
  var date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throwHttpError(400, field + ' must be a valid date');
  }

  return date;
}

function assertValidObjectId(value, fieldName) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throwHttpError(400, fieldName + ' must be a valid ObjectId');
  }
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  getDashboard: getDashboard,
  getConfig: getConfig,
  updateConfig: updateConfig,
  syncMenu: syncMenu,
  updatePricing: updatePricing,
  createPromotion: createPromotion,
  getPromotions: getPromotions,
  updatePromotion: updatePromotion,
  deletePromotion: deletePromotion,
  getMenuSyncPreview: getMenuSyncPreview
};
