var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var router = express.Router();

router.use(authMiddleware.authenticate);

router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager', 'kitchen', 'cashier', 'staff']));



var recipeController = require('../controllers/recipe.controller');

// UC70: View recipes
router.get('/', authMiddleware.authenticate, recipeController.getRecipes);

module.exports = router;
