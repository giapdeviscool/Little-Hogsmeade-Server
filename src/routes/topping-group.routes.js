var express = require('express');
var router = express.Router();
var toppingGroupController = require('../controllers/topping-group.controller');
var authMiddleware = require('../middlewares/auth.middleware');

router.get('/', authMiddleware.authenticate, authMiddleware.requireChainRole, toppingGroupController.getToppingGroups);
router.post('/', authMiddleware.authenticate, authMiddleware.requireChainRole, toppingGroupController.createToppingGroup);
router.delete('/:id', authMiddleware.authenticate, authMiddleware.requireChainRole, toppingGroupController.softDeleteToppingGroup);

module.exports = router;
