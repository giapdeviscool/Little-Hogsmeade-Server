var express = require('express');
var categoryController = require('../controllers/category.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

// Categories require authentication + Owner/Chain Admin role
router.use(authMiddleware.authenticate);
// router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager']));

// UC63: View menu categories
router.get('/', categoryController.getCategories);

// UC64: Manage menu categories
router.post('/', categoryController.createCategory);
router.put('/:id', categoryController.updateCategory);
router.patch('/:id/move', categoryController.moveCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
