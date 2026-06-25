const preparationService = require('../services/preparation.service');

exports.getPreparationRecipes = async (req, res, next) => {
  try {
    const preparations = await preparationService.getPreparationRecipes(req.query, req.user);
    res.json({
      success: true,
      data: preparations
    });
  } catch (err) {
    next(err);
  }
};

exports.getPreparationRecipeById = async (req, res, next) => {
  try {
    const { preparationId } = req.params;
    const preparation = await preparationService.getPreparationRecipeById(req.user, req.query.branchId, preparationId);
    res.json({
      success: true,
      data: preparation
    });
  } catch (err) {
    next(err);
  }
};

exports.setPreparationRecipe = async (req, res, next) => {
  try {
    const { preparationId } = req.params;
    const recipeData = req.body.recipeData;

    if (!Array.isArray(recipeData)) {
      return res.status(400).json({ success: false, message: 'recipeData must be an array' });
    }

    for (const item of recipeData) {
      if (!item.rawIngredientId) {
        return res.status(400).json({ success: false, message: 'Invalid rawIngredientId' });
      }
      if (typeof item.quantityRequired !== 'number' || item.quantityRequired <= 0) {
        return res.status(400).json({ success: false, message: 'quantityRequired must be greater than 0' });
      }
      if (typeof item.yieldQuantity !== 'number' || item.yieldQuantity <= 0) {
        return res.status(400).json({ success: false, message: 'yieldQuantity must be greater than 0' });
      }
    }

    const recipe = await preparationService.setPreparationRecipe(req.user, req.query.branchId, preparationId, recipeData);
    res.json({
      success: true,
      data: recipe,
      message: 'Preparation recipe updated successfully'
    });
  } catch (err) {
    next(err);
  }
};
