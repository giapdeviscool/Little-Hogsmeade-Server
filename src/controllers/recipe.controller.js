var recipeService = require('../services/recipe.service');

async function getRecipes(req, res, next) {
  try {
    var result = await recipeService.getRecipes(req.query || {}, req.user);
    res.json({ data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function setMenuItemRecipes(req, res, next) {
  try {
    var menuItemId = req.params.id; // from PUT /api/v1/menu-items/:id/recipes
    var variantId = req.body.variantId;
    var recipes = req.body.recipes || [];
    var result = await recipeService.setMenuItemRecipes(menuItemId, variantId, recipes, req.user);
    res.json({ data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = {
  getRecipes: getRecipes,
  setMenuItemRecipes: setMenuItemRecipes
};
