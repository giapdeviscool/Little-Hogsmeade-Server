var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager', 'kitchen', 'cashier', 'staff']));

var ingredientController = require('../controllers/ingredient.controller');

router.get('/stats', authMiddleware.authenticate, ingredientController.getStats);
router.get('/', authMiddleware.authenticate, ingredientController.getIngredients);
router.post('/', authMiddleware.authenticate, authMiddleware.requireChainRole, ingredientController.createIngredient);
router.put('/:id', authMiddleware.authenticate, authMiddleware.requireChainRole, ingredientController.updateIngredient);

module.exports = router;
