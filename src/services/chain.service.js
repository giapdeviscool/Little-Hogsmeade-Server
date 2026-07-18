var branchRepository = require('../repositories/branch.repository');
var chainRepository = require('../repositories/chain.repository');
var ingredientRepository = require('../repositories/ingredient.repository');
var authMiddleware = require('../middlewares/auth.middleware');
var xlsx = require('xlsx');

async function getDashboard(query) {
  var dateRange = parseDateRange(query.startDate, query.endDate);
  var branchId = query.branchId || null;
  var invoiceWhere = {
    createdAt: {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    },
    status: { in: ['paid', 'Paid', 'completed', 'Completed'] },
    order: {}
  };
  var expenseWhere = {
    date: {
      gte: dateRange.startDate,
      lte: dateRange.endDate
    }
  };
  var branchWhere = branchId ? { id: branchId } : {};

  if (branchId) {
    assertValidObjectId(branchId, 'branchId');
    invoiceWhere.order.branchId = branchId;
    expenseWhere.branchId = branchId;
  }

  var results = await Promise.all([
    chainRepository.findInvoices(invoiceWhere),
    chainRepository.sumExpenses(expenseWhere),
    chainRepository.sumExpensesByBranch(expenseWhere),
    ingredientRepository.countLowStockByBranch(branchId),
    branchRepository.findAll({ where: branchWhere })
  ]);
  var invoices = results[0];
  var expenseResult = results[1];
  var expensesByBranch = results[2];
  var lowStockCounts = results[3];
  var branches = results[4];
  var totalOrders = invoices.length;
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
    branchPerformance: buildBranchPerformance(invoices, expensesByBranch, branches),
    lowStockAlerts: buildLowStockAlerts(lowStockCounts, branches)
  };
}

async function exportDashboard(query) {
  const dashboard = await getDashboard(query || {});

  const kpis = dashboard?.kpis || {};
  const overviewRows = [
    { metric: 'Tổng doanh thu', value: kpis.totalRevenue || 0 },
    { metric: 'Tổng đơn hàng', value: kpis.totalOrders || 0 },
    { metric: 'Lợi nhuận gộp', value: kpis.grossProfit || 0 }
  ];

  const revenueRows = (dashboard?.revenueSeries || []).map(item => ({
    date: item?.date || '',
    revenue: item?.revenue || 0
  }));

  const branchRows = (dashboard?.branchPerformance || []).map(item => ({
    branchName: item?.branchName || '',
    revenue: item?.revenue || 0,
    orders: item?.orders || 0,
    grossProfit: item?.grossProfit || 0
  }));

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(overviewRows), 'Tổng quan');
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(revenueRows), 'Doanh thu theo ngày');
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(branchRows), 'Hiệu suất chi nhánh');

  const rawStart = dashboard?.filters?.startDate ? String(dashboard.filters.startDate).substring(0, 10) : 'start';
  const rawEnd = dashboard?.filters?.endDate ? String(dashboard.filters.endDate).substring(0, 10) : 'end';
  
  const cleanStart = rawStart.replace(/[^a-zA-Z0-9-]/g, '');
  const cleanEnd = rawEnd.replace(/[^a-zA-Z0-9-]/g, '');

  return {
    buffer: xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' }),
    fileName: `bao-cao-chuoi_${cleanStart}_${cleanEnd}.xlsx`
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
  return chainRepository.createVoucher(data);
}

async function getPromotions(query) {
  var page = parsePositiveInt(query.page, 1);
  var limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  var skip = (page - 1) * limit;

  var where = {};

  if (query.search) {
    var searchStr = String(query.search).trim();
    where.OR = [
      { name: { contains: searchStr, mode: 'insensitive' } },
      { description: { contains: searchStr, mode: 'insensitive' } },
      { code: { contains: searchStr, mode: 'insensitive' } }
    ];
  }

  if (query.customerId) {
    where.customerId = query.customerId;
  }

  if (query.status === 'active') {
    where.isActive = true;
  } else if (query.status === 'inactive') {
    where.isActive = false;
  }

  var items = await chainRepository.findVouchers({
    where: where,
    skip: skip,
    take: limit,
    orderBy: { startDate: 'desc' }
  });
  
  var total = await chainRepository.countVouchers(where);

  return {
    items: items,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function updatePromotion(id, payload) {
  var data = normalizePromotionPayload(payload);
  return chainRepository.updateVoucher(id, data);
}

async function togglePromotionStatus(id) {
  assertValidObjectId(id, 'promotion id');
  var voucher = await chainRepository.findVoucherById(id);

  if (!voucher) {
    throwHttpError(404, 'Promotion not found');
  }

  var newStatus = !voucher.isActive;
  return chainRepository.updateVoucher(id, { isActive: newStatus });
}

async function deletePromotion(id) {
  return chainRepository.deleteVoucher(id);
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
  var expireDate = parseDate(payload.endDate || payload.expireDate, 'expireDate');
  var scope = String(payload.scope || 'global').trim().toLowerCase();
  var appliedBranches = Array.isArray(payload.appliedBranches) ? payload.appliedBranches : [];

  if (expireDate <= startDate) {
    throwHttpError(400, 'expireDate must be greater than startDate');
  }

  if (scope !== 'global' && scope !== 'specific') {
    throwHttpError(400, 'scope must be global or specific');
  }

  for (var i = 0; i < appliedBranches.length; i += 1) {
    assertValidObjectId(appliedBranches[i], 'appliedBranches');
  }

  var discountValue = Number(payload.discountValue);
  if (isNaN(discountValue) || discountValue < 0) {
    throwHttpError(400, 'discountValue must be a positive number');
  }

  var minOrderValue = Number(payload.minOrderValue) || 0;
  var maxUses = Number(payload.maxUses) || 100;
  
  var requiresCode = payload.requiresCode !== undefined ? Boolean(payload.requiresCode) : true;
  var code = requiresCode && payload.code ? String(payload.code).trim() : null;

  return {
    name: assertNonEmptyString(payload.name, 'name'),
    description: payload.description ? String(payload.description) : null,
    code: code,
    requiresCode: requiresCode,
    startDate: startDate,
    expireDate: expireDate,
    discountValue: discountValue,
    discountType: payload.discountType === 'fixed' ? 'fixed' : 'percent',
    minOrderValue: minOrderValue,
    maxUses: maxUses,
    scope: scope,
    appliedBranches: scope === 'global' ? [] : appliedBranches,
    isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true
  };
}

function parseDateRange(startDateValue, endDateValue) {
  var endDate = endDateValue ? parseDate(endDateValue, 'endDate') : new Date();
  var startDate = startDateValue ? parseDate(startDateValue, 'startDate') : new Date(endDate);

  if (!startDateValue) {
    startDate.setDate(startDate.getDate() - 30);
  }

  if (endDateValue) {
    endDate.setUTCHours(23, 59, 59, 999);
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

function buildBranchPerformance(invoices, expensesByBranch, branches) {
  var buckets = {};
  var branchNames = buildBranchNameMap(branches);
  var expenseMap = buildExpenseMap(expensesByBranch);

  invoices.forEach(function(invoice) {
    var branch = invoice.order && invoice.order.branch;
    var branchId = branch ? branch.id : 'unknown';

    if (!buckets[branchId]) {
      buckets[branchId] = {
        branchId: branchId,
        branchName: branch ? branch.name : (branchNames[branchId] || 'Unknown branch'),
        revenue: 0,
        orders: 0,
        grossProfit: 0
      };
    }

    buckets[branchId].revenue += invoice.totalAmount;
    buckets[branchId].orders += 1;
  });

  Object.keys(expenseMap).forEach(function(branchId) {
    if (!buckets[branchId]) {
      buckets[branchId] = {
        branchId: branchId,
        branchName: branchNames[branchId] || 'Unknown branch',
        revenue: 0,
        orders: 0,
        grossProfit: 0
      };
    }
  });

  return Object.keys(buckets).map(function(branchId) {
    buckets[branchId].grossProfit = buckets[branchId].revenue - (expenseMap[branchId] || 0);
    return buckets[branchId];
  }).sort(function(a, b) {
    return b.revenue - a.revenue;
  });
}

function buildLowStockAlerts(lowStockCounts, branches) {
  var branchNames = buildBranchNameMap(branches);
  var countMap = {};

  lowStockCounts.forEach(function(item) {
    countMap[normalizeRawObjectId(item._id)] = item.count || 0;
  });

  var alertBranchIds = Object.keys(countMap).filter(function(branchId) {
    return countMap[branchId] > 0;
  });

  var result = alertBranchIds.map(function(branchId) {
    return {
      branchId: branchId,
      branchName: branchNames[branchId] || 'Unknown branch',
      count: countMap[branchId]
    };
  });

  return result;
}

function buildBranchNameMap(branches) {
  var branchNames = {};

  branches.forEach(function(branch) {
    branchNames[branch.id] = branch.name;
  });

  return branchNames;
}

function buildExpenseMap(expensesByBranch) {
  var expenseMap = {};

  expensesByBranch.forEach(function(item) {
    expenseMap[item.branchId] = item._sum.amount || 0;
  });

  return expenseMap;
}

function normalizeRawObjectId(value) {
  if (!value) {
    return 'unknown';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value.$oid) {
    return value.$oid;
  }

  if (value.oid) {
    return value.oid;
  }

  return String(value);
}

function dateToFilePart(value) {
  return new Date(value).toISOString().slice(0, 10);
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

function parsePositiveInt(value, fallback) {
  var parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

module.exports = {
  getDashboard: getDashboard,
  exportDashboard: exportDashboard,
  getConfig: getConfig,
  updateConfig: updateConfig,
  syncMenu: syncMenu,
  updatePricing: updatePricing,
  createPromotion: createPromotion,
  getPromotions: getPromotions,
  updatePromotion: updatePromotion,
  togglePromotionStatus: togglePromotionStatus,
  deletePromotion: deletePromotion,
  getMenuSyncPreview: getMenuSyncPreview
};
