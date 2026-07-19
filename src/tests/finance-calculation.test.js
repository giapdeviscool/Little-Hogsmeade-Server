/**
 * Unit Test cho Finance Calculation Service
 * 
 * Sử dụng bộ số liệu "Anh Tuấn" (mục 1.3 trong prompt):
 *   Doanh thu tháng: 300.000.000 VND
 *   Số ly bán ra: 6.000
 *   Giá bán TB/ly: 50.000
 *   Giá vốn NVL/ly: 20.000
 *   TFC: 327.000.000
 *   TVC (tổng chi tiết): 210.000.000 (hoặc 231.000.000 theo khai báo thủ công)
 */

var calc = require('../services/finance-calculation.service');

// ===================== Test Fixtures =====================
var REVENUE = 300000000;           // 300 triệu
var UNITS_SOLD = 6000;             // 6.000 ly
var AVG_PRICE = 50000;             // 50.000/ly
var COGS_PER_UNIT = 20000;         // 20.000/ly

var TFC = 327000000;               // 327 triệu (tổng cố định)
var TVC_DETAIL_SUM = 210000000;    // 210 triệu (tổng cộng từ chi tiết liệt kê)
var TVC_DECLARED = 231000000;      // 231 triệu (tổng khai báo thủ công — lệch!)

// ===================== Test Runner =====================
var totalTests = 0;
var passedTests = 0;
var failedTests = [];

function assertEqual(testName, actual, expected, tolerance) {
  totalTests++;
  if (tolerance === undefined) tolerance = 0.01;

  var pass;
  if (typeof expected === 'number' && isFinite(expected)) {
    pass = Math.abs(actual - expected) <= tolerance;
  } else if (expected === Infinity) {
    pass = actual === Infinity;
  } else if (expected === -Infinity) {
    pass = actual === -Infinity;
  } else {
    pass = actual === expected;
  }

  if (pass) {
    passedTests++;
    console.log('  ✓ ' + testName);
  } else {
    failedTests.push(testName);
    console.log('  ✗ ' + testName);
    console.log('    Expected: ' + expected);
    console.log('    Actual:   ' + actual);
  }
}

function assertDeepEqual(testName, actual, expected) {
  totalTests++;
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    passedTests++;
    console.log('  ✓ ' + testName);
  } else {
    failedTests.push(testName);
    console.log('  ✗ ' + testName);
    console.log('    Expected: ' + JSON.stringify(expected));
    console.log('    Actual:   ' + JSON.stringify(actual));
  }
}

// ===================== Test Suites =====================

console.log('\n═══════════════════════════════════════════════');
console.log('  FINANCE CALCULATION SERVICE — UNIT TESTS');
console.log('═══════════════════════════════════════════════\n');

// --- calcTotalCost ---
console.log('▸ calcTotalCost');
assertEqual(
  'TFC=327M + TVC=210M = 537M',
  calc.calcTotalCost(TFC, TVC_DETAIL_SUM),
  537000000
);
assertEqual(
  'TFC=327M + TVC=231M (declared) = 558M',
  calc.calcTotalCost(TFC, TVC_DECLARED),
  558000000
);
assertEqual(
  'Edge: both zero',
  calc.calcTotalCost(0, 0),
  0
);

// --- calcVariableCostPerUnit ---
console.log('\n▸ calcVariableCostPerUnit');
assertEqual(
  'TVC=210M / 6000 units = 35.000/unit',
  calc.calcVariableCostPerUnit(TVC_DETAIL_SUM, UNITS_SOLD),
  35000
);
assertEqual(
  'Edge: 0 units sold',
  calc.calcVariableCostPerUnit(TVC_DETAIL_SUM, 0),
  0
);

// --- calcGrossProfit ---
console.log('\n▸ calcGrossProfit');
assertEqual(
  'Revenue=300M - TVC=210M = 90M',
  calc.calcGrossProfit(REVENUE, TVC_DETAIL_SUM),
  90000000
);
assertEqual(
  'Revenue=300M - TVC=231M (declared) = 69M',
  calc.calcGrossProfit(REVENUE, TVC_DECLARED),
  69000000
);

// --- calcGrossMargin ---
console.log('\n▸ calcGrossMargin');
assertEqual(
  'Gross Margin with TVC=210M = 30%',
  calc.calcGrossMargin(REVENUE, TVC_DETAIL_SUM),
  30,
  0.01
);
assertEqual(
  'Gross Margin with TVC=231M = 23%',
  calc.calcGrossMargin(REVENUE, TVC_DECLARED),
  23,
  0.01
);
assertEqual(
  'Edge: revenue=0',
  calc.calcGrossMargin(0, TVC_DETAIL_SUM),
  0
);

// --- calcNetProfit ---
console.log('\n▸ calcNetProfit');
assertEqual(
  'Revenue=300M - TFC=327M - TVC=210M = -237M (lỗ)',
  calc.calcNetProfit(REVENUE, TFC, TVC_DETAIL_SUM),
  -237000000
);
assertEqual(
  'Revenue=300M - TFC=327M - TVC=231M = -258M (lỗ)',
  calc.calcNetProfit(REVENUE, TFC, TVC_DECLARED),
  -258000000
);
// Kịch bản hàng tháng (TFC tính khấu hao theo tháng, vd 12 tháng)
var TFC_MONTHLY = 0; // Nếu TFC chỉ là chi phí 1 lần, 
// thì hàng tháng chỉ có TVC → NetProfit = Revenue - TVC
assertEqual(
  'Kịch bản tháng: Revenue=300M - TFC=0 - TVC=210M = 90M lợi nhuận',
  calc.calcNetProfit(REVENUE, TFC_MONTHLY, TVC_DETAIL_SUM),
  90000000
);

// --- calcNetMargin ---
console.log('\n▸ calcNetMargin');
assertEqual(
  'Net Margin (hàng tháng TFC=0, TVC=210M) = 30%',
  calc.calcNetMargin(REVENUE, 0, TVC_DETAIL_SUM),
  30,
  0.01
);

// --- calcBreakEvenRevenue ---
console.log('\n▸ calcBreakEvenRevenue');
// BEP Rev = TFC / [1 - (TVC/Revenue)]
// = 327M / [1 - (210M/300M)]
// = 327M / [1 - 0.7]
// = 327M / 0.3
// = 1.090.000.000
assertEqual(
  'BEP Revenue: TFC=327M, TVC=210M, Rev=300M → 1.090.000.000',
  calc.calcBreakEvenRevenue(TFC, TVC_DETAIL_SUM, REVENUE),
  1090000000,
  1 // Cho phép lệch 1 VND do floating point
);
// Với TVC khai báo = 231M
// = 327M / [1 - (231M/300M)]
// = 327M / [1 - 0.77]
// = 327M / 0.23
// = 1.421.739.130,43
assertEqual(
  'BEP Revenue: TFC=327M, TVC=231M, Rev=300M → ~1.421.739.130',
  calc.calcBreakEvenRevenue(TFC, TVC_DECLARED, REVENUE),
  1421739130.43,
  1
);
assertEqual(
  'Edge: revenue=0',
  calc.calcBreakEvenRevenue(TFC, TVC_DETAIL_SUM, 0),
  Infinity
);
assertEqual(
  'Edge: TVC >= Revenue (no contribution margin)',
  calc.calcBreakEvenRevenue(TFC, 300000000, 300000000),
  Infinity
);

// --- calcBreakEvenUnits ---
console.log('\n▸ calcBreakEvenUnits');
// BEP Units = TFC / (Avg Price - VCU)
// VCU = 210M / 6000 = 35.000
// BEP Units = 327M / (50.000 - 35.000) = 327M / 15.000 = 21.800
var VCU = calc.calcVariableCostPerUnit(TVC_DETAIL_SUM, UNITS_SOLD);
assertEqual(
  'BEP Units: TFC=327M, AvgPrice=50K, VCU=35K → 21.800 ly',
  calc.calcBreakEvenUnits(TFC, AVG_PRICE, VCU),
  21800,
  1
);
// Với COGS per unit = 20.000 (chỉ NVL, không tính các biến phí khác)
assertEqual(
  'BEP Units (chỉ COGS): TFC=327M, AvgPrice=50K, COGS/unit=20K → 10.900 ly',
  calc.calcBreakEvenUnits(TFC, AVG_PRICE, COGS_PER_UNIT),
  10900,
  1
);
assertEqual(
  'Edge: avgPrice <= VCU (no margin)',
  calc.calcBreakEvenUnits(TFC, 35000, 35000),
  Infinity
);

// --- calcMarginOfSafety ---
console.log('\n▸ calcMarginOfSafety');
var BEP_REV = calc.calcBreakEvenRevenue(TFC, TVC_DETAIL_SUM, REVENUE); // 1.090.000.000
assertEqual(
  'Margin of Safety = 300M - 1.090M = -790M (chưa hòa vốn)',
  calc.calcMarginOfSafety(REVENUE, BEP_REV),
  REVENUE - BEP_REV,
  1
);
assertEqual(
  'Edge: BEP = Infinity',
  calc.calcMarginOfSafety(REVENUE, Infinity),
  -Infinity
);

// --- calcMarginOfSafetyPercent ---
console.log('\n▸ calcMarginOfSafetyPercent');
assertEqual(
  'MoS% with revenue=300M and BEP=1.090M',
  calc.calcMarginOfSafetyPercent(REVENUE, BEP_REV),
  ((REVENUE - BEP_REV) / REVENUE) * 100,
  0.01
);

// --- validateCostConsistency ---
console.log('\n▸ validateCostConsistency');
var resultConsistent = calc.validateCostConsistency(210000000, 210000000);
assertEqual(
  'Consistent: 210M vs 210M → isConsistent=true',
  resultConsistent.isConsistent,
  true
);
assertEqual(
  'Consistent: differencePercent=0',
  resultConsistent.differencePercent,
  0
);

var resultInconsistent = calc.validateCostConsistency(TVC_DECLARED, TVC_DETAIL_SUM);
assertEqual(
  'Inconsistent: 231M vs 210M → isConsistent=false',
  resultInconsistent.isConsistent,
  false
);
// difference = 21M, base = 231M, percent = 21/231*100 ≈ 9.09%
assertEqual(
  'Inconsistent: differencePercent ≈ 9.09',
  resultInconsistent.differencePercent,
  9.09,
  0.01
);

var resultWithCustomThreshold = calc.validateCostConsistency(TVC_DECLARED, TVC_DETAIL_SUM, 10);
assertEqual(
  'Custom threshold 10%: 231M vs 210M (9.09%) → isConsistent=true',
  resultWithCustomThreshold.isConsistent,
  true
);

var resultBothZero = calc.validateCostConsistency(0, 0);
assertEqual(
  'Edge: both zero → isConsistent=true',
  resultBothZero.isConsistent,
  true
);

// --- calcCostStructure ---
console.log('\n▸ calcCostStructure');
var items = [
  { name: 'Nguyên vật liệu', amount: 120000000, costType: 'VARIABLE' },
  { name: 'Thuê nhà', amount: 15000000, costType: 'FIXED' },
  { name: 'Marketing', amount: 15000000, costType: 'VARIABLE' }
];
var structure = calc.calcCostStructure(items, 150000000);
assertEqual(
  'NVL: 120M/150M = 80%',
  structure[0].percent,
  80,
  0.01
);
assertEqual(
  'Thuê nhà: 15M/150M = 10%',
  structure[1].percent,
  10,
  0.01
);

var structureZero = calc.calcCostStructure(items, 0);
assertEqual(
  'Edge: totalCost=0 → all percent=0',
  structureZero[0].percent,
  0
);

// ===================== Summary =====================
console.log('\n═══════════════════════════════════════════════');
console.log('  RESULTS: ' + passedTests + '/' + totalTests + ' tests passed');
if (failedTests.length > 0) {
  console.log('  FAILED: ' + failedTests.join(', '));
}
console.log('═══════════════════════════════════════════════\n');

process.exit(failedTests.length > 0 ? 1 : 0);
