const financeService = require('../services/finance.service');

async function getDashboardData(req, res, next) {
  try {
    const { branchId, startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu startDate hoặc endDate' });
    }
    const summary = await financeService.getDashboardData(branchId, startDate, endDate);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}

async function getBreakEven(req, res, next) {
  try {
    const { branchId, startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu startDate hoặc endDate' });
    }
    const breakEven = await financeService.getBreakEven(branchId, startDate, endDate);
    res.json({ success: true, data: breakEven });
  } catch (error) {
    next(error);
  }
}

async function getCostStructure(req, res, next) {
  try {
    const { branchId, startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu startDate hoặc endDate' });
    }
    const costStructure = await financeService.getCostStructure(branchId, startDate, endDate);
    res.json({ success: true, data: costStructure });
  } catch (error) {
    next(error);
  }
}

async function generateSnapshot(req, res, next) {
  try {
    const { branchId, periodStart, periodEnd } = req.body;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ success: false, message: 'Thiếu periodStart hoặc periodEnd' });
    }
    const snapshot = await financeService.generateSnapshot(branchId, periodStart, periodEnd);
    res.status(201).json({ success: true, data: snapshot, message: 'Đã tạo bản lưu chốt số liệu tài chính' });
  } catch (error) {
    next(error);
  }
}

async function getSnapshots(req, res, next) {
  try {
    const { branchId } = req.query;
    const snapshots = await financeService.getSnapshots(branchId);
    res.json({ success: true, data: snapshots });
  } catch (error) {
    next(error);
  }
}

async function getDailyProfit(req, res, next) {
  try {
    const { branchId, startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu startDate hoặc endDate' });
    }
    const dailyProfit = await financeService.getDailyProfit(branchId, startDate, endDate);
    res.json({ success: true, data: dailyProfit });
  } catch (error) {
    next(error);
  }
}

async function exportReport(req, res, next) {
  try {
    const { branchId, startDate, endDate, format } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Thiếu startDate hoặc endDate' });
    }
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    
    // Log audit trail (Requirement BR36 - simply console for now, should save to DB in full system)
    console.log(`[AUDIT] User ${req.user.id} exported financial report. branchId: ${branchId}, range: ${startDate}-${endDate}`);
    
    const buffer = await financeService.exportReport(branchId, startDate, endDate, format);
    
    res.setHeader('Content-Disposition', `attachment; filename="Bao-cao-tai-chinh-${startDate}-den-${endDate}.${ext}"`);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
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
