const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class PreparationRepository {
  async getPreparationRecipes(branchId, search) {
    const whereClause = {
      branchId,
      ingredientType: 'preparation',
      isActive: true,
    };

    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    return prisma.ingredient.findMany({
      where: whereClause,
      include: {
        preparationIngredients: {
          include: {
            rawIngredient: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async getPreparationRecipeById(preparationId) {
    return prisma.ingredient.findUnique({
      where: { id: preparationId },
      include: {
        preparationIngredients: {
          include: {
            rawIngredient: true
          }
        }
      }
    });
  }

  async setPreparationRecipe(preparationId, recipeData) {
    return prisma.$transaction(async (tx) => {
      // Delete existing recipe parts
      await tx.preparationRecipe.deleteMany({
        where: { preparationId }
      });

      if (!recipeData || recipeData.length === 0) {
        return [];
      }

      // Create new recipe parts
      const createData = recipeData.map(item => ({
        preparationId,
        rawIngredientId: item.rawIngredientId,
        quantityRequired: item.quantityRequired,
        yieldQuantity: item.yieldQuantity,
        instructions: item.instructions || null
      }));

      await tx.preparationRecipe.createMany({
        data: createData
      });

      return tx.preparationRecipe.findMany({
        where: { preparationId },
        include: { rawIngredient: true }
      });
    });
  }

  async findActiveRecipesUsingPreparation(preparationId) {
    return prisma.recipe.findMany({
      where: {
        ingredientId: preparationId,
        menuItem: {
          isActive: true
        }
      },
      include: {
        menuItem: true
      }
    });
  }
}

module.exports = new PreparationRepository();
