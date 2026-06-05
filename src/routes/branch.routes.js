var express = require('express');
var branchController = require('../controllers/branch.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

router.get('/', branchController.getBranches);
router.post('/', authMiddleware.requireOwner, branchController.createBranch);
router.put('/:id', branchController.updateBranch);
router.patch('/:id/deactivate', branchController.deactivateBranch);

module.exports = router;
