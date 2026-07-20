var express = require('express');
var employeeController = require('../controllers/employee.controller');
var employeeRepository = require('../repositories/employee.repository');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

// All employee routes require authentication + Owner/Chain Admin role
router.use(authMiddleware.authenticate);

router.use(authMiddleware.verifyRole(['owner', 'chain admin']));


// UC55: View the Staff list
router.get('/', employeeController.getEmployees);

// UC56: Create employee profile
router.post('/', authMiddleware.requireChainRole, employeeController.createEmployee);

// UC57: Update employee status
router.put('/:id', authMiddleware.requireChainRole, employeeController.updateEmployee);

// UC58: Assign account roles
router.put('/:id/role', authMiddleware.requireChainRole, employeeController.assignRole);

module.exports = router;
