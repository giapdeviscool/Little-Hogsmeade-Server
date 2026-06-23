var express = require('express');
var branchController = require('../controllers/branch.controller');
var tableController = require('../controllers/table.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.get('/', branchController.getBranches);

// UC88: Staff, Manager and Admin can view the table layout for their branch.
router.get('/:branchId/tables', authMiddleware.authenticate, tableController.getTableLayout);

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);
router.post('/', authMiddleware.requireOwner, branchController.createBranch);
router.put('/:id', branchController.updateBranch);
router.patch('/:id/toggle-status', branchController.toggleBranchStatus);

module.exports = router;
