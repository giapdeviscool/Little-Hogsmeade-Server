const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const expenseService = require('./expense.service');
const financeCalc = require('./finance-calculation.service');
const xlsx = require('xlsx');

// Lấy dữ liệu dashboard tổng hợp (sử dụng logic từ expense.service đã được refactor)
async function getDashboardData(branchId, from, to) {
  return await expenseService.getFinancialSummary(branchId, { startDate: from, endDate: to });
}

// Lấy riêng thông tin điểm hòa vốn
async function getBreakEven(branchId, from, to) {
  const summary = await getDashboardData(branchId, from, to);
  return {
    breakEvenRevenue: summary.breakEvenRevenue,
    breakEvenUnits: summary.breakEvenUnits,
    marginOfSafety: summary.marginOfSafety,
    marginOfSafetyPercent: summary.marginOfSafetyPercent
  };
}

// Lấy cơ cấu chi phí (Dùng cho Pie chart)
async function getCostStructure(branchId, from, to) {
  const summary = await getDashboardData(branchId, from, to);
  
  const allItems = [];
  
  // Combine all costs
  summary.fixedCosts.breakdown.forEach(function(item) {
    allItems.push({ name: item.name, amount: item.amount, costType: 'FIXED' });
  });
  summary.variableCosts.breakdown.forEach(function(item) {
    allItems.push({ name: item.name, amount: item.amount, costType: 'VARIABLE' });
  });
  summary.semiVariableCosts.breakdown.forEach(function(item) {
    allItems.push({ name: item.name, amount: item.amount, costType: 'SEMI_VARIABLE' });
  });

  return financeCalc.calcCostStructure(allItems, summary.totalCost);
}

// Chốt sổ: Tạo snapshot lưu vào database
async function generateSnapshot(branchId, periodStart, periodEnd) {
  const summary = await getDashboardData(branchId, periodStart, periodEnd);
  
  return await prisma.financialSnapshot.create({
    data: {
      branchId: branchId || null,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalRevenue: summary.revenue,
      totalFixedCost: summary.fixedCosts.total,
      totalVariableCost: summary.variableCosts.total,
      cogs: 0, // Simplified for now, can be extracted from specific COGS accounts
      grossProfit: summary.grossProfit,
      netProfit: summary.netProfit,
      breakEvenRevenue: isFinite(summary.breakEvenRevenue) ? summary.breakEvenRevenue : 0
    }
  });
}

// Lấy danh sách snapshot
async function getSnapshots(branchId) {
  const where = branchId ? { branchId } : {};
  return await prisma.financialSnapshot.findMany({
    where: where,
    orderBy: { periodStart: 'desc' },
    include: {
      branch: { select: { id: true, name: true } }
    }
  });
}

// Xuất báo cáo (Buffer excel)
async function exportReport(branchId, from, to, format) {
  const summary = await getDashboardData(branchId, from, to);
  const branchName = branchId ? "Chi nhánh" : "Toàn chuỗi";

  const data = [
    ["BÁO CÁO TÀI CHÍNH"],
    ["Chi nhánh/Chuỗi", branchName],
    ["Từ ngày", from, "Đến ngày", to],
    [],
    ["CHỈ SỐ TÀI CHÍNH", "GIÁ TRỊ (VNĐ) / (%)"],
    ["Doanh thu (Revenue)", summary.revenue],
    ["Tổng chi phí (Total Cost)", summary.totalCost],
    ["  - Định phí (TFC)", summary.fixedCosts.total],
    ["  - Biến phí (TVC)", summary.variableCosts.total],
    ["  - Hỗn hợp (Semi)", summary.semiVariableCosts.total],
    ["Lợi nhuận gộp (Gross Profit)", summary.grossProfit],
    ["Biên lợi nhuận gộp (Gross Margin)", summary.grossMargin + "%"],
    ["Lợi nhuận ròng (Net Profit)", summary.netProfit],
    ["Biên lợi nhuận ròng (Net Margin)", summary.netMargin + "%"],
    ["Điểm hòa vốn (Break-even Revenue)", isFinite(summary.breakEvenRevenue) ? summary.breakEvenRevenue : "Không thể tính"],
    ["Biên an toàn (Margin of Safety)", isFinite(summary.marginOfSafety) ? summary.marginOfSafety : "Không thể tính"],
    [],
    ["CƠ CẤU CHI PHÍ CHI TIẾT", "SỐ TIỀN", "PHẦN TRĂM DOANH THU (%)"]
  ];

  summary.fixedCosts.breakdown.forEach(function(item) {
    const percent = summary.revenue > 0 ? (item.amount / summary.revenue) * 100 : 0;
    data.push([item.name + " (Cố định)", item.amount, percent.toFixed(2) + "%"]);
  });
  summary.variableCosts.breakdown.forEach(function(item) {
    const percent = summary.revenue > 0 ? (item.amount / summary.revenue) * 100 : 0;
    data.push([item.name + " (Biến đổi)", item.amount, percent.toFixed(2) + "%"]);
  });
  summary.semiVariableCosts.breakdown.forEach(function(item) {
    const percent = summary.revenue > 0 ? (item.amount / summary.revenue) * 100 : 0;
    data.push([item.name + " (Hỗn hợp)", item.amount, percent.toFixed(2) + "%"]);
  });

  const ws = xlsx.utils.aoa_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Financial Report");

  // Generate buffer
  return xlsx.write(wb, { type: 'buffer', bookType: format === 'csv' ? 'csv' : 'xlsx' });
}

// ──────────────────────────────────────────────────────────────────────────────
// Báo cáo lợi nhuận thuần theo ngày
// Công thức: Lãi/ngày = Doanh thu/ngày − COGS/ngày − Định phí tháng / Số ngày trong tháng
//
// - Doanh thu/ngày: Σ Invoice.totalAmount (paid) của ngày đó
// - COGS/ngày: Σ (cost NL × số cốc loại đó) tính từ BOM recipe
// - Định phí/ngày: Tổng phiếu chi FIXED cả tháng / số ngày trong tháng
//   + Nếu chưa có phiếu chi "Điện nước" → cộng mặc định 6.000.000đ
// ──────────────────────────────────────────────────────────────────────────────
const DEFAULT_UTILITY_COST = 6000000; // 6 triệu VND mặc định cho điện nước
const UTILITY_KEYWORDS = ['điện', 'nước', 'dien', 'nuoc', 'electricity', 'water', 'utility', 'tiện ích'];

function hasUtilityExpense(expenses) {
  for (const exp of expenses) {
    const catName = (exp.expenseCategory?.name || '').toLowerCase();
    const desc = (exp.description || '').toLowerCase();
    for (const keyword of UTILITY_KEYWORDS) {
      if (catName.includes(keyword) || desc.includes(keyword)) {
        return true;
      }
    }
  }
  return false;
}

async function getDailyProfit(branchId, from, to) {
  const start = new Date(from);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  // ─── Xác định tháng hiện tại để lấy toàn bộ Fixed Cost cả tháng ───
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  monthEnd.setHours(23, 59, 59, 999);
  const daysInMonth = monthEnd.getDate(); // Số ngày trong tháng (28/29/30/31)

  // 1. Lấy toàn bộ phiếu chi FIXED trong CẢ THÁNG (không chỉ range query)
  const monthlyExpenses = await prisma.expense.findMany({
    where: {
      branchId: branchId || undefined,
      date: { gte: monthStart, lte: monthEnd }
    },
    include: { expenseCategory: true }
  });

  let totalFixedMonth = 0;
  const fixedBreakdown = [];
  for (const exp of monthlyExpenses) {
    const costType = (exp.expenseCategory?.costType || exp.expenseCategory?.type || 'VARIABLE').toUpperCase();
    if (costType === 'FIXED') {
      totalFixedMonth += exp.amount;
      fixedBreakdown.push({ name: exp.expenseCategory?.name || exp.description, amount: exp.amount });
    } else if (costType === 'SEMI_VARIABLE') {
      totalFixedMonth += exp.amount / 2;
      fixedBreakdown.push({ name: (exp.expenseCategory?.name || exp.description) + ' (50%)', amount: exp.amount / 2 });
    }
  }

  // Nếu chưa có phiếu chi điện nước → cộng mặc định 6 triệu
  const hasUtility = hasUtilityExpense(monthlyExpenses);
  let defaultUtilityUsed = false;
  if (!hasUtility) {
    totalFixedMonth += DEFAULT_UTILITY_COST;
    fixedBreakdown.push({ name: 'Điện nước (mặc định)', amount: DEFAULT_UTILITY_COST });
    defaultUtilityUsed = true;
  }

  const dailyFixedCost = totalFixedMonth / daysInMonth;

  // 2. Get Orders with full details to calculate COGS dynamically
  const orders = await prisma.order.findMany({
    where: {
      branchId: branchId || undefined,
      status: { in: ['completed', 'paid'] },
      createdAt: { gte: start, lte: end }
    },
    include: {
      invoices: true,
      orderItems: {
        include: {
          menuItem: {
            include: { recipes: { include: { ingredient: true } } }
          },
          variant: {
            include: { recipes: { include: { ingredient: true } } }
          },
          orderItemToppings: {
            include: { topping: true }
          }
        }
      }
    }
  });

  const dailyMap = {};
  const localIngredientCache = {};

  async function getTrueIngredientCost(bId, ingredientId) {
    let targetIngredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      include: { preparationIngredients: true }
    });

    if (targetIngredient && targetIngredient.branchId === null && bId) {
      const localCopy = await prisma.ingredient.findFirst({
        where: { globalIngredientId: targetIngredient.id, branchId: bId },
        include: { preparationIngredients: true }
      });
      if (localCopy) {
        targetIngredient = localCopy;
      }
    }

    if (!targetIngredient) return 0;

    const key = bId + '-' + targetIngredient.id;
    if (localIngredientCache[key] !== undefined) return localIngredientCache[key];

    if (targetIngredient.ingredientType === 'preparation') {
      let recipesToUse = targetIngredient.preparationIngredients;
      if (!recipesToUse || recipesToUse.length === 0) {
        if (targetIngredient.globalIngredientId) {
          const globalPrep = await prisma.ingredient.findUnique({
            where: { id: targetIngredient.globalIngredientId },
            include: { preparationIngredients: true }
          });
          if (globalPrep && globalPrep.preparationIngredients) {
            recipesToUse = globalPrep.preparationIngredients;
          }
        }
      }

      if (!recipesToUse || recipesToUse.length === 0) {
        localIngredientCache[key] = 0;
        return 0;
      }

      let totalCost = 0;
      let yieldQty = recipesToUse[0].yieldQuantity || 1;
      for (const pr of recipesToUse) {
        const rawCost = await getTrueIngredientCost(bId, pr.rawIngredientId);
        totalCost += (pr.quantityRequired * rawCost);
      }
      localIngredientCache[key] = yieldQty > 0 ? totalCost / yieldQty : 0;
      return localIngredientCache[key];
    } else {
      const lastReceipt = await prisma.stockTransaction.findFirst({
        where: { ingredientId: targetIngredient.id, type: 'RECEIPT' },
        orderBy: { createdAt: 'desc' }
      });
      let cost = lastReceipt ? lastReceipt.unitCost : (targetIngredient.unitCost || 0);
      localIngredientCache[key] = cost;
      return cost;
    }
  }

  for (const order of orders) {
    const dateStr = new Date(order.createdAt).toISOString().split('T')[0];
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { revenue: 0, cogs: 0, unitsSold: 0 };
    }

    let orderRevenue = 0;
    if (order.invoices && order.invoices.length > 0) {
      orderRevenue = order.invoices[0].totalAmount || 0;
    } else if (order.orderItems) {
      for (const item of order.orderItems) {
        orderRevenue += item.subtotal || 0;
      }
    }
    
    dailyMap[dateStr].revenue += orderRevenue;

    // Calculate COGS (cost nguyên liệu × số cốc)
    for (const item of order.orderItems) {
      let itemCost = 0;
      
      // MenuItem cost from BOM
      if (item.menuItem?.recipes) {
        for (const r of item.menuItem.recipes) {
          if (r.variantId) continue; // Bỏ qua recipe của variant
          let cost = await getTrueIngredientCost(order.branchId, r.ingredientId);
          itemCost += (r.quantityRequired * cost);
        }
      }
      
      // Variant cost from BOM
      if (item.variant?.recipes) {
        for (const r of item.variant.recipes) {
          let cost = await getTrueIngredientCost(order.branchId, r.ingredientId);
          itemCost += (r.quantityRequired * cost);
        }
      }
      
      // Topping cost
      if (item.orderItemToppings) {
        for (const t of item.orderItemToppings) {
          itemCost += (t.quantity * (t.topping?.baseCost || 0));
        }
      }
      
      dailyMap[dateStr].cogs += (itemCost * item.quantity);
      dailyMap[dateStr].unitsSold += item.quantity;
    }
  }

  // Build daily result
  const days = [];
  const curr = new Date(start);
  while (curr <= end) {
    const dateStr = curr.toISOString().split('T')[0];
    const data = dailyMap[dateStr] || { revenue: 0, cogs: 0, unitsSold: 0 };
    
    days.push({
      date: dateStr,
      revenue: Math.round(data.revenue),
      cogs: Math.round(data.cogs),           // Cost nguyên liệu (COGS)
      fixedCostPerDay: Math.round(dailyFixedCost), // Định phí / ngày
      netProfit: Math.round(data.revenue - data.cogs - dailyFixedCost),
      unitsSold: data.unitsSold
    });
    
    curr.setDate(curr.getDate() + 1);
  }

  return {
    days: days,
    meta: {
      daysInMonth: daysInMonth,
      totalFixedMonth: Math.round(totalFixedMonth),
      dailyFixedCost: Math.round(dailyFixedCost),
      defaultUtilityUsed: defaultUtilityUsed,
      defaultUtilityAmount: defaultUtilityUsed ? DEFAULT_UTILITY_COST : 0,
      fixedBreakdown: fixedBreakdown
    }
  };
}

module.exports = {
  getDashboardData,
  getBreakEven,
  getCostStructure,
  generateSnapshot,
  getSnapshots,
  exportReport,
  getDailyProfit
};
