var ingredientService = require('../services/ingredient.service');

async function getIngredients(req, res, next) {
  try {
    var result = await ingredientService.getIngredients(req.query || {}, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function createIngredient(req, res, next) {
  try {
    var result = await ingredientService.createIngredient(req.body, req.user);
    res.status(201).json({ data: result, message: 'Material Saved Successfully' });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function updateIngredient(req, res, next) {
  try {
    var result = await ingredientService.updateIngredient(req.params.id, req.body, req.user);
    res.json({ data: result, message: 'Material Updated Successfully' });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function getStats(req, res, next) {
  try {
    var result = await ingredientService.getStats(req.query.branchId, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStats: getStats,
  getIngredients: getIngredients,
  createIngredient: createIngredient,
  updateIngredient: updateIngredient
};
