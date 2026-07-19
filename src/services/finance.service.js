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

// Báo cáo lợi nhuận thuần theo ngày
async function getDailyProfit(branchId, from, to) {
  const start = new Date(from);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // 1. Get Fixed Expenses
  const expenses = await prisma.expense.findMany({
    where: {
      branchId: branchId || undefined,
      date: { gte: start, lte: end }
    },
    include: { expenseCategory: true }
  });

  let totalFixed = 0;
  for (const exp of expenses) {
    const costType = exp.expenseCategory?.costType || exp.expenseCategory?.type || 'VARIABLE';
    if (costType.toUpperCase() === 'FIXED') {
      totalFixed += exp.amount;
    } else if (costType.toUpperCase() === 'SEMI_VARIABLE') {
      totalFixed += exp.amount / 2; // Allocate half to fixed as per existing logic
    }
  }
  const dailyFixedCost = totalFixed / (diffDays || 1);

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
  async function getLocalIngredientCost(globalId, bId) {
    var key = globalId + '-' + bId;
    if (localIngredientCache[key] !== undefined) return localIngredientCache[key];
    var loc = await prisma.ingredient.findFirst({ where: { globalIngredientId: globalId, branchId: bId } });
    localIngredientCache[key] = loc ? (loc.unitCost || 0) : 0;
    return localIngredientCache[key];
  }

  for (const order of orders) {
    const dateStr = new Date(order.createdAt).toISOString().split('T')[0];
    if (!dailyMap[dateStr]) {
      dailyMap[dateStr] = { revenue: 0, variableCost: 0 };
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

    // Calculate COGS
    for (const item of order.orderItems) {
      let itemCost = 0;
      
      // MenuItem cost
      if (item.menuItem?.recipes) {
        for (const r of item.menuItem.recipes) {
          if (r.ingredient && r.ingredient.branchId === null) {
            let locCost = await getLocalIngredientCost(r.ingredientId, order.branchId);
            itemCost += (r.quantityRequired * locCost);
          } else {
            itemCost += (r.quantityRequired * (r.ingredient?.unitCost || 0));
          }
        }
      }
      
      // Variant cost
      if (item.variant?.recipes) {
        for (const r of item.variant.recipes) {
          if (r.ingredient && r.ingredient.branchId === null) {
            let locCost = await getLocalIngredientCost(r.ingredientId, order.branchId);
            itemCost += (r.quantityRequired * locCost);
          } else {
            itemCost += (r.quantityRequired * (r.ingredient?.unitCost || 0));
          }
        }
      }
      
      // Topping cost
      if (item.orderItemToppings) {
        for (const t of item.orderItemToppings) {
          itemCost += (t.quantity * (t.topping?.baseCost || 0));
        }
      }
      
      dailyMap[dateStr].variableCost += (itemCost * item.quantity);
    }
  }

  // Build result
  const result = [];
  const curr = new Date(start);
  while (curr <= end) {
    const dateStr = curr.toISOString().split('T')[0];
    const data = dailyMap[dateStr] || { revenue: 0, variableCost: 0 };
    
    result.push({
      date: dateStr,
      revenue: data.revenue,
      variableCost: Math.round(data.variableCost),
      fixedCost: Math.round(dailyFixedCost),
      netProfit: Math.round(data.revenue - data.variableCost - dailyFixedCost)
    });
    
    curr.setDate(curr.getDate() + 1);
  }

  return result;
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
