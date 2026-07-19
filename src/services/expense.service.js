const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const financeCalc = require('./finance-calculation.service');

// ===================== Expense Categories =====================

async function getExpenseCategories() {
  return await prisma.expenseCategory.findMany({
    orderBy: { name: 'asc' }
  });
}

async function createExpenseCategory(data) {
  var name = data.name;
  var costType = data.costType || data.type || 'VARIABLE';
  var isSystem = data.isSystem || false;
  var branchId = data.branchId || null;

  // Normalize costType: backward compat with old "fixed"/"variable"
  if (costType === 'fixed') costType = 'FIXED';
  if (costType === 'variable') costType = 'VARIABLE';

  if (!name) throw { status: 400, message: 'Tên danh mục là bắt buộc' };

  var existing = await prisma.expenseCategory.findUnique({ where: { name } });
  if (existing) throw { status: 400, message: 'Danh mục đã tồn tại' };

  return await prisma.expenseCategory.create({
    data: { name: name, costType: costType, isSystem: isSystem, branchId: branchId }
  });
}

async function updateExpenseCategory(id, data) {
  var category = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!category) throw { status: 404, message: 'Danh mục không tồn tại' };
  if (category.isSystem) throw { status: 400, message: 'Không thể sửa danh mục hệ thống' };

  var updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.costType !== undefined) {
    var ct = data.costType;
    if (ct === 'fixed') ct = 'FIXED';
    if (ct === 'variable') ct = 'VARIABLE';
    updateData.costType = ct;
  }
  if (data.branchId !== undefined) updateData.branchId = data.branchId;

  return await prisma.expenseCategory.update({ where: { id }, data: updateData });
}

async function deleteExpenseCategory(id) {
  var category = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!category) throw { status: 404, message: 'Danh mục không tồn tại' };
  if (category.isSystem) throw { status: 400, message: 'Không thể xóa danh mục hệ thống' };

  var expensesCount = await prisma.expense.count({ where: { expenseCategoryId: id } });
  var costEntriesCount = await prisma.costEntry.count({ where: { categoryId: id } });
  if (expensesCount > 0 || costEntriesCount > 0) {
    throw { status: 400, message: 'Không thể xóa danh mục đang có phiếu chi hoặc ghi nhận chi phí' };
  }
  
  return await prisma.expenseCategory.delete({ where: { id } });
}

// ===================== Expenses (Phiếu chi đơn giản — giữ nguyên) =====================

async function getExpenses(branchId, filterOptions) {
  if (!filterOptions) filterOptions = {};
  var startDate = filterOptions.startDate;
  var endDate = filterOptions.endDate;
  var where = { branchId: branchId };
  if (startDate && endDate) {
    where.date = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  return await prisma.expense.findMany({
    where: where,
    include: {
      expenseCategory: true,
      employee: {
        select: { id: true, fullName: true }
      }
    },
    orderBy: { date: 'desc' }
  });
}

async function createExpense(data, employeeId) {
  var branchId = data.branchId;
  var expenseCategoryId = data.expenseCategoryId;
  var amount = data.amount;
  var description = data.description;
  var date = data.date;
  var receiptUrl = data.receiptUrl;

  if (!branchId || !expenseCategoryId || !amount || !description || !date) {
    throw { status: 400, message: 'Vui lòng điền đầy đủ thông tin phiếu chi' };
  }

  return await prisma.expense.create({
    data: {
      branchId: branchId,
      expenseCategoryId: expenseCategoryId,
      amount: parseFloat(amount),
      description: description,
      date: new Date(date),
      receiptUrl: receiptUrl,
      employeeId: employeeId
    },
    include: {
      expenseCategory: true,
      employee: {
        select: { id: true, fullName: true }
      }
    }
  });
}

async function deleteExpense(id) {
  return await prisma.expense.delete({ where: { id: id } });
}

// ===================== Financial Summary (Enhanced) =====================

async function getFinancialSummary(branchId, filterOptions) {
  if (!filterOptions) filterOptions = {};
  var startDate = filterOptions.startDate;
  var endDate = filterOptions.endDate;
  if (!branchId || !startDate || !endDate) throw { status: 400, message: 'Thiếu tham số bắt buộc' };

  var start = new Date(startDate);
  var end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // 1. Revenue from paid invoices
  var paidInvoices = await prisma.invoice.findMany({
    where: {
      status: 'paid',
      createdAt: { gte: start, lte: end },
      order: { branchId: branchId }
    },
    select: { totalAmount: true }
  });
  var revenue = paidInvoices.reduce(function(sum, inv) { return sum + inv.totalAmount; }, 0);

  // 2. Total units sold (from OrderItems of paid orders)
  var paidOrders = await prisma.order.findMany({
    where: {
      branchId: branchId,
      status: { in: ['completed', 'paid'] },
      createdAt: { gte: start, lte: end }
    },
    select: { id: true }
  });
  var paidOrderIds = paidOrders.map(function(o) { return o.id; });

  var orderItemsAgg = await prisma.orderItem.aggregate({
    where: { orderId: { in: paidOrderIds } },
    _sum: { quantity: true }
  });
  var totalUnitsSold = (orderItemsAgg._sum && orderItemsAgg._sum.quantity) || 0;

  // 3. Average price per unit
  var avgPricePerUnit = totalUnitsSold > 0 ? revenue / totalUnitsSold : 0;

  // 4. Expenses grouped by category costType
  var expenses = await prisma.expense.findMany({
    where: {
      branchId: branchId,
      date: { gte: start, lte: end }
    },
    include: { expenseCategory: true }
  });

  var fixedCosts = { total: 0, items: {} };
  var variableCosts = { total: 0, items: {} };
  var semiVariableCosts = { total: 0, items: {} };

  for (var i = 0; i < expenses.length; i++) {
    var exp = expenses[i];
    var cat = exp.expenseCategory;
    var amount = exp.amount;
    // Use costType (new field), fallback to old type field for backward compat
    var costType = cat.costType || cat.type || 'VARIABLE';
    // Normalize
    if (costType === 'fixed' || costType === 'FIXED') {
      fixedCosts.total += amount;
      fixedCosts.items[cat.name] = (fixedCosts.items[cat.name] || 0) + amount;
    } else if (costType === 'SEMI_VARIABLE') {
      semiVariableCosts.total += amount;
      semiVariableCosts.items[cat.name] = (semiVariableCosts.items[cat.name] || 0) + amount;
    } else {
      variableCosts.total += amount;
      variableCosts.items[cat.name] = (variableCosts.items[cat.name] || 0) + amount;
    }
  }

  // For calculation purposes, SEMI_VARIABLE is split equally between fixed and variable
  var semiHalf = semiVariableCosts.total / 2;
  var totalFixed = fixedCosts.total + semiHalf;
  var totalVariable = variableCosts.total + semiHalf;
  var totalCost = financeCalc.calcTotalCost(totalFixed, totalVariable);

  // Use pure functions from finance-calculation.service
  var grossProfit = financeCalc.calcGrossProfit(revenue, totalVariable);
  var grossMargin = financeCalc.calcGrossMargin(revenue, totalVariable);
  var netProfit = financeCalc.calcNetProfit(revenue, totalFixed, totalVariable);
  var netMargin = financeCalc.calcNetMargin(revenue, totalFixed, totalVariable);
  var variableCostPerUnit = financeCalc.calcVariableCostPerUnit(totalVariable, totalUnitsSold);
  var breakEvenRevenue = financeCalc.calcBreakEvenRevenue(totalFixed, totalVariable, revenue);
  var breakEvenUnits = financeCalc.calcBreakEvenUnits(totalFixed, avgPricePerUnit, variableCostPerUnit);
  var marginOfSafety = financeCalc.calcMarginOfSafety(revenue, breakEvenRevenue);
  var marginOfSafetyPercent = financeCalc.calcMarginOfSafetyPercent(revenue, breakEvenRevenue);

  // Format breakdown arrays
  function toBreakdown(itemsObj) {
    return Object.entries(itemsObj)
      .map(function(entry) { return { name: entry[0], amount: entry[1] }; })
      .sort(function(a, b) { return b.amount - a.amount; });
  }

  return {
    revenue: revenue,
    totalUnitsSold: totalUnitsSold,
    avgPricePerUnit: avgPricePerUnit,
    fixedCosts: { total: fixedCosts.total, breakdown: toBreakdown(fixedCosts.items) },
    variableCosts: { total: variableCosts.total, breakdown: toBreakdown(variableCosts.items) },
    semiVariableCosts: { total: semiVariableCosts.total, breakdown: toBreakdown(semiVariableCosts.items) },
    totalCost: totalCost,
    grossProfit: grossProfit,
    grossMargin: grossMargin,
    netProfit: netProfit,
    netMargin: netMargin,
    variableCostPerUnit: variableCostPerUnit,
    breakEvenRevenue: isFinite(breakEvenRevenue) ? breakEvenRevenue : null,
    breakEvenUnits: isFinite(breakEvenUnits) ? breakEvenUnits : null,
    marginOfSafety: isFinite(marginOfSafety) ? marginOfSafety : null,
    marginOfSafetyPercent: marginOfSafetyPercent
  };
}

module.exports = {
  getExpenseCategories: getExpenseCategories,
  createExpenseCategory: createExpenseCategory,
  updateExpenseCategory: updateExpenseCategory,
  deleteExpenseCategory: deleteExpenseCategory,
  getExpenses: getExpenses,
  createExpense: createExpense,
  deleteExpense: deleteExpense,
  getFinancialSummary: getFinancialSummary
};
