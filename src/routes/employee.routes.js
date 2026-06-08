var express = require('express');
var employeeController = require('../controllers/employee.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

// All employee routes require authentication + Owner/Chain Admin role
router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

// UC55: View the Staff list
router.get('/', employeeController.getEmployees);

// UC56: Create employee profile
router.post('/', employeeController.createEmployee);

// UC57: Update employee status
router.put('/:id', employeeController.updateEmployee);

module.exports = router;
