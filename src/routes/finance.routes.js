const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Apply auth middleware to all routes
router.use(authMiddleware.authenticate);
// Ensure only chain admins/owners can access finance reports
// Assuming we have requireChainRole or we can just use authenticate for now
// and rely on frontend for hiding, but let's apply requireChainRole if possible.
// For simplicity and since we don't know the exact signature of requireChainRole,
// we will just authenticate. The prompt says: "RBAC middleware chặn Staff/Cashier riêng cho finance routes".
// We will add a quick middleware for role check.

const requireChainAdminOrOwner = (req, res, next) => {
  const role = req.user.role?.name || req.user.role; // depending on how it's populated
  if (role === 'staff' || role === 'cashier') {
    return res.status(403).json({ success: false, message: 'Forbidden: Bạn không có quyền xem báo cáo tài chính' });
  }
  next();
};

const requireOwner = (req, res, next) => {
  const role = req.user.role?.name || req.user.role;
  if (role !== 'owner') {
    return res.status(403).json({ success: false, message: 'Forbidden: Chỉ chủ chuỗi mới được chốt sổ' });
  }
  next();
};

router.use(requireChainAdminOrOwner);

router.get('/dashboard', financeController.getDashboardData);
router.get('/break-even', financeController.getBreakEven);
router.get('/cost-structure', financeController.getCostStructure);
router.get('/export', financeController.exportReport);
router.get('/snapshots', financeController.getSnapshots);
router.get('/daily-profit', financeController.getDailyProfit);

// POST /snapshot/generate chỉ cho Owner
router.post('/snapshot/generate', requireOwner, financeController.generateSnapshot);

module.exports = router;
