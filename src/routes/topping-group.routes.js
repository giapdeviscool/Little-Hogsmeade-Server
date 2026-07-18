var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager']));

var toppingGroupController = require('../controllers/topping-group.controller');

router.get('/', authMiddleware.authenticate, authMiddleware.requireChainRole, toppingGroupController.getToppingGroups);
router.post('/', authMiddleware.authenticate, authMiddleware.requireChainRole, toppingGroupController.createToppingGroup);
router.put('/:id', authMiddleware.authenticate, authMiddleware.requireChainRole, toppingGroupController.updateToppingGroup);
router.delete('/:id', authMiddleware.authenticate, authMiddleware.requireChainRole, toppingGroupController.softDeleteToppingGroup);

module.exports = router;
