const express = require('express');
const router = express.Router();
const preparationController = require('../controllers/preparation.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware.authenticate);

router.get('/', preparationController.getPreparationRecipes);

router.get('/:preparationId', preparationController.getPreparationRecipeById);

router.put('/:preparationId/recipe', preparationController.setPreparationRecipe);

module.exports = router;
