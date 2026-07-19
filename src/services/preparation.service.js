const preparationRepo = require('../repositories/preparation.repository');
const ingredientService = require('./ingredient.service');
const { isOwner } = require('../middlewares/auth.middleware');

class PreparationService {
  async getPreparationRecipes(query, user) {
    let branchId = user.branchId;
    if (isOwner(user)) {
      branchId = query.branchId || undefined;
    }
    return preparationRepo.getPreparationRecipes(branchId, query.search);
  }

  async getPreparationRecipeById(user, targetBranchId, preparationId) {
    const preparation = await preparationRepo.getPreparationRecipeById(preparationId);
    if (!preparation) {
      const error = new Error('Preparation not found');
      error.statusCode = 404;
      throw error;
    }
    if (preparation.branchId !== user.branchId && !isOwner(user)) {
      const error = new Error('Forbidden');
      error.statusCode = 403;
      throw error;
    }

    if (preparation.globalIngredientId !== null) {
      const globalPrep = await preparationRepo.getPreparationRecipeById(preparation.globalIngredientId);
      if (globalPrep) {
        preparation.preparationIngredients = globalPrep.preparationIngredients || [];
      }
    }

    return preparation;
  }

  async setPreparationRecipe(user, targetBranchId, preparationId, recipeData) {
    const preparation = await preparationRepo.getPreparationRecipeById(preparationId);
    if (!preparation) {
      const error = new Error('Preparation not found');
      error.statusCode = 404;
      throw error;
    }
    if (preparation.branchId !== user.branchId && !isOwner(user)) {
      const error = new Error('Forbidden');
      error.statusCode = 403;
      throw error;
    }

    if (preparation.globalIngredientId !== null) {
      const error = new Error('Không thể cấu hình BOM cho bản sao của Nguyên liệu Toàn chuỗi. Vui lòng chọn "Tất cả chi nhánh" để cấu hình cho nguyên liệu gốc.');
      error.statusCode = 400;
      throw error;
    }
    if (preparation.ingredientType !== 'preparation') {
      const error = new Error('Ingredient is not a preparation type');
      error.statusCode = 400;
      throw error;
    }

    if (recipeData && recipeData.length > 0) {
      const yieldQuantity = recipeData[0].yieldQuantity;
      for (const item of recipeData) {
        if (item.yieldQuantity !== yieldQuantity) {
          const error = new Error('All ingredients in a formula must share the same yieldQuantity');
          error.statusCode = 400;
          throw error;
        }
        // Use preparation.branchId to fetch raw ingredient
        const rawIng = await ingredientService.getIngredientById(preparation.branchId, item.rawIngredientId);
        if (rawIng.ingredientType !== 'raw') {
          const error = new Error('Preparation recipe can only reference raw ingredients');
          error.statusCode = 400;
          throw error;
        }
      }
    }

    return preparationRepo.setPreparationRecipe(preparationId, recipeData);
  }
}

module.exports = new PreparationService();
