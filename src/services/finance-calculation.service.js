/**
 * Finance Calculation Service
 * 
 * Pure functions cho việc tính toán tài chính.
 * Không phụ thuộc vào Database — dễ test độc lập.
 * 
 * Các công thức theo yêu cầu UC83:
 *   TFC = Tổng Chi Phí Cố Định
 *   TVC = Tổng Chi Phí Biến Đổi
 *   VCU = TVC / Số lượng sản phẩm bán ra
 *   Total Cost = TFC + TVC
 *   Revenue = Σ (Giá bán × Số lượng) từ POS
 *   Gross Profit = Revenue - TVC
 *   Gross Margin % = (Gross Profit / Revenue) × 100
 *   Net Profit = Revenue - (TFC + TVC)
 *   Break-even Revenue = TFC / [1 - (TVC / Revenue)]
 *   Break-even Units = TFC / (Avg Price per Unit - Variable Cost per Unit)
 *   Margin of Safety = Actual Revenue - Break-even Revenue
 */

/**
 * Tính tổng chi phí
 * @param {number} fixedCost - Tổng chi phí cố định
 * @param {number} variableCost - Tổng chi phí biến đổi
 * @returns {number} Tổng chi phí
 */
function calcTotalCost(fixedCost, variableCost) {
  return fixedCost + variableCost;
}

/**
 * Tính chi phí biến đổi trên mỗi đơn vị sản phẩm
 * @param {number} totalVariableCost - Tổng chi phí biến đổi
 * @param {number} totalUnitsSold - Tổng số sản phẩm bán ra
 * @returns {number} Chi phí biến đổi / đơn vị
 */
function calcVariableCostPerUnit(totalVariableCost, totalUnitsSold) {
  if (totalUnitsSold <= 0) return 0;
  return totalVariableCost / totalUnitsSold;
}

/**
 * Tính lợi nhuận gộp (Gross Profit = Revenue - TVC)
 * @param {number} revenue - Doanh thu
 * @param {number} variableCost - Tổng chi phí biến đổi
 * @returns {number} Lợi nhuận gộp
 */
function calcGrossProfit(revenue, variableCost) {
  return revenue - variableCost;
}

/**
 * Tính biên lợi nhuận gộp (Gross Margin %)
 * @param {number} revenue - Doanh thu
 * @param {number} variableCost - Tổng chi phí biến đổi
 * @returns {number} Gross Margin % (0-100)
 */
function calcGrossMargin(revenue, variableCost) {
  if (revenue <= 0) return 0;
  return (calcGrossProfit(revenue, variableCost) / revenue) * 100;
}

/**
 * Tính lợi nhuận ròng (Net Profit = Revenue - TFC - TVC)
 * @param {number} revenue - Doanh thu
 * @param {number} fixedCost - Tổng chi phí cố định
 * @param {number} variableCost - Tổng chi phí biến đổi
 * @returns {number} Lợi nhuận ròng
 */
function calcNetProfit(revenue, fixedCost, variableCost) {
  return revenue - fixedCost - variableCost;
}

/**
 * Tính biên lợi nhuận ròng (Net Margin %)
 * @param {number} revenue - Doanh thu
 * @param {number} fixedCost - Tổng chi phí cố định
 * @param {number} variableCost - Tổng chi phí biến đổi
 * @returns {number} Net Margin % (0-100)
 */
function calcNetMargin(revenue, fixedCost, variableCost) {
  if (revenue <= 0) return 0;
  return (calcNetProfit(revenue, fixedCost, variableCost) / revenue) * 100;
}

/**
 * Tính điểm hòa vốn theo doanh thu
 * Break-even Revenue = TFC / [1 - (TVC / Revenue)]
 * 
 * Nếu TVC >= Revenue (contribution margin ratio <= 0), trả Infinity (không thể hòa vốn)
 * 
 * @param {number} fixedCost - Tổng chi phí cố định
 * @param {number} variableCost - Tổng chi phí biến đổi
 * @param {number} revenue - Doanh thu thực tế (dùng để tính tỷ lệ biến phí)
 * @returns {number} Doanh thu cần đạt để hòa vốn
 */
function calcBreakEvenRevenue(fixedCost, variableCost, revenue) {
  if (revenue <= 0) return Infinity;
  var contributionMarginRatio = 1 - (variableCost / revenue);
  if (contributionMarginRatio <= 0) return Infinity;
  return fixedCost / contributionMarginRatio;
}

/**
 * Tính điểm hòa vốn theo số lượng sản phẩm
 * Break-even Units = TFC / (Avg Price per Unit - Variable Cost per Unit)
 * 
 * @param {number} fixedCost - Tổng chi phí cố định
 * @param {number} avgPricePerUnit - Giá bán trung bình / đơn vị
 * @param {number} variableCostPerUnit - Chi phí biến đổi / đơn vị
 * @returns {number} Số lượng sản phẩm cần bán để hòa vốn
 */
function calcBreakEvenUnits(fixedCost, avgPricePerUnit, variableCostPerUnit) {
  var contributionMarginPerUnit = avgPricePerUnit - variableCostPerUnit;
  if (contributionMarginPerUnit <= 0) return Infinity;
  return fixedCost / contributionMarginPerUnit;
}

/**
 * Tính biên an toàn (Margin of Safety)
 * = Doanh thu thực tế - Doanh thu hòa vốn
 * 
 * @param {number} actualRevenue - Doanh thu thực tế
 * @param {number} breakEvenRevenue - Doanh thu hòa vốn
 * @returns {number} Biên an toàn (VND)
 */
function calcMarginOfSafety(actualRevenue, breakEvenRevenue) {
  if (!isFinite(breakEvenRevenue)) return -Infinity;
  return actualRevenue - breakEvenRevenue;
}

/**
 * Tính biên an toàn theo % (Margin of Safety %)
 * = (Doanh thu thực tế - Doanh thu hòa vốn) / Doanh thu thực tế × 100
 * 
 * @param {number} actualRevenue - Doanh thu thực tế
 * @param {number} breakEvenRevenue - Doanh thu hòa vốn
 * @returns {number} Biên an toàn %
 */
function calcMarginOfSafetyPercent(actualRevenue, breakEvenRevenue) {
  if (actualRevenue <= 0 || !isFinite(breakEvenRevenue)) return 0;
  return ((actualRevenue - breakEvenRevenue) / actualRevenue) * 100;
}

/**
 * Kiểm tra tính nhất quán của tổng chi phí khai báo so với tổng các khoản chi tiết.
 * Nếu lệch quá ngưỡng % → trả warning.
 * 
 * @param {number} declaredTotal - Tổng chi phí do người dùng khai báo thủ công
 * @param {number} sumOfItems - Tổng cộng các khoản mục chi tiết
 * @param {number} [thresholdPercent=5] - Ngưỡng % chấp nhận được (mặc định 5%)
 * @returns {{ isConsistent: boolean, declaredTotal: number, sumOfItems: number, differencePercent: number, message: string }}
 */
function validateCostConsistency(declaredTotal, sumOfItems, thresholdPercent) {
  if (thresholdPercent === undefined || thresholdPercent === null) {
    thresholdPercent = 5;
  }

  // Edge cases
  if (declaredTotal === 0 && sumOfItems === 0) {
    return {
      isConsistent: true,
      declaredTotal: declaredTotal,
      sumOfItems: sumOfItems,
      differencePercent: 0,
      message: 'Khớp: cả hai đều bằng 0.'
    };
  }

  var base = Math.max(Math.abs(declaredTotal), Math.abs(sumOfItems));
  if (base === 0) base = 1; // avoid division by zero

  var difference = Math.abs(declaredTotal - sumOfItems);
  var differencePercent = (difference / base) * 100;

  var isConsistent = differencePercent <= thresholdPercent;

  return {
    isConsistent: isConsistent,
    declaredTotal: declaredTotal,
    sumOfItems: sumOfItems,
    differencePercent: Math.round(differencePercent * 100) / 100,
    message: isConsistent
      ? 'Dữ liệu nhất quán (lệch ' + differencePercent.toFixed(2) + '%).'
      : 'CẢNH BÁO: Tổng khai báo (' + declaredTotal.toLocaleString('vi-VN') +
        ' đ) lệch với tổng chi tiết (' + sumOfItems.toLocaleString('vi-VN') +
        ' đ) ' + differencePercent.toFixed(2) + '%, vượt ngưỡng ' + thresholdPercent + '%.'
  };
}

/**
 * Tính tỷ lệ cơ cấu chi phí (dùng để vẽ Pie chart)
 * @param {Array<{name: string, amount: number, costType: string}>} items - Danh sách khoản mục
 * @param {number} totalCost - Tổng chi phí
 * @returns {Array<{name: string, amount: number, costType: string, percent: number}>}
 */
function calcCostStructure(items, totalCost) {
  if (totalCost <= 0) {
    return items.map(function(item) {
      return {
        name: item.name,
        amount: item.amount,
        costType: item.costType,
        percent: 0
      };
    });
  }

  return items.map(function(item) {
    return {
      name: item.name,
      amount: item.amount,
      costType: item.costType,
      percent: Math.round((item.amount / totalCost) * 10000) / 100 // 2 decimal places
    };
  });
}

module.exports = {
  calcTotalCost: calcTotalCost,
  calcVariableCostPerUnit: calcVariableCostPerUnit,
  calcGrossProfit: calcGrossProfit,
  calcGrossMargin: calcGrossMargin,
  calcNetProfit: calcNetProfit,
  calcNetMargin: calcNetMargin,
  calcBreakEvenRevenue: calcBreakEvenRevenue,
  calcBreakEvenUnits: calcBreakEvenUnits,
  calcMarginOfSafety: calcMarginOfSafety,
  calcMarginOfSafetyPercent: calcMarginOfSafetyPercent,
  validateCostConsistency: validateCostConsistency,
  calcCostStructure: calcCostStructure
};
