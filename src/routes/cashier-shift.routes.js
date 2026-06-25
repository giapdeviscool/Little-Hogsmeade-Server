var express = require('express');
var cashierShiftController = require('../controllers/cashier-shift.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

// All cashier shift endpoints require an authenticated user (Cashier/Staff/Admin)
router.use(authMiddleware.authenticate);

// Phase 1: Open a new shift
router.post('/open', cashierShiftController.openShift);

// UI Initialization: Check for an active shift
router.get('/active', cashierShiftController.checkActiveShift);

// Phase 3: Request shift closure (Calculates end-of-day math, triggers SMS OTP)
router.post('/:id/close-request', cashierShiftController.requestClosure);

// Phase 4: Final closure with Manager OTP override
router.post('/:id/close', cashierShiftController.closeShift);

module.exports = router;
