var express = require('express');
var router = express.Router();
var ingredientController = require('../controllers/ingredient.controller');
var authMiddleware = require('../middlewares/auth.middleware');

router.get('/', authMiddleware.authenticate, ingredientController.getIngredients);
router.post('/', authMiddleware.authenticate, authMiddleware.requireChainRole, ingredientController.createIngredient);
router.put('/:id', authMiddleware.authenticate, authMiddleware.requireChainRole, ingredientController.updateIngredient);

module.exports = router;
