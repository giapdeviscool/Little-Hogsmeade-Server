var express = require('express');
var payrollController = require('../controllers/payroll.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);



// All payroll routes require authentication
// Service layer handles RBAC data isolation (Staff sees only own, Admin sees branch, Owner sees all)
router.use(authMiddleware.authenticate);

// UC62: View payroll data
router.get('/', payrollController.getPayroll);

module.exports = router;
