var express = require('express');
var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager']));

var recipeController = require('../controllers/recipe.controller');
var authMiddleware = require('../middlewares/auth.middleware');

// UC70: View recipes
router.get('/', authMiddleware.authenticate, recipeController.getRecipes);

module.exports = router;
