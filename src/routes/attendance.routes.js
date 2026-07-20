var express = require('express');
var attendanceController = require('../controllers/attendance.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'cashier', 'kitchen', 'staff']));


// Check-in/check-out do NOT require JWT — they use PIN-based auth
// The service layer handles PIN validation internally
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);

// Admin view requires JWT + Chain role
router.get('/today',
  authMiddleware.authenticate,
  authMiddleware.requireChainRole,
  attendanceController.getTodayAttendance
);

module.exports = router;
