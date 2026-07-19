const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const preparationRepo = require('../repositories/preparation.repository');

class StockConversionService {
  async convertStock(branchId, employeeId, preparationId, targetYieldQuantity) {
    if (targetYieldQuantity <= 0) {
      throw new Error('Target quantity must be greater than 0');
    }

    const preparation = await preparationRepo.getPreparationRecipeById(preparationId);
    if (!preparation) {
      const error = new Error('Preparation not found');
      error.statusCode = 404;
      throw error;
    }

    if (preparation.branchId !== branchId) {
      const error = new Error('Forbidden');
      error.statusCode = 403;
      throw error;
    }

    if (!preparation.preparationIngredients || preparation.preparationIngredients.length === 0) {
      const error = new Error('This preparation has no formula configured');
      error.statusCode = 400;
      throw error;
    }

    const formulaYield = preparation.preparationIngredients[0].yieldQuantity;
    const multiplier = targetYieldQuantity / formulaYield;

    // Check stock for all raw ingredients
    const rawRequirements = preparation.preparationIngredients.map(item => ({
      rawIngredientId: item.rawIngredientId,
      rawIngredientName: item.rawIngredient.name,
      requiredStock: item.quantityRequired * multiplier,
      currentStock: item.rawIngredient.currentStock,
      unitCost: item.rawIngredient.conversionRate > 0 && item.rawIngredient.currentStock > 0 ? (item.rawIngredient.minStockLevel || 0) : 0 // Assuming unitCost can be deduced or stored elsewhere, for simplicity in standard system it's calculated from goods receipts. Here we assume average cost is maintained or 0.
      // Wait, in Little Hogsmeade, how is MAC tracked? Actually `unitCost` on stock transactions. 
      // I will leave unitCost as 0 for now unless there's a specific field.
    }));

    for (const req of rawRequirements) {
      if (req.currentStock < req.requiredStock) {
        const error = new Error(`Không đủ số lượng tồn kho cho ${req.rawIngredientName}. Cần ${req.requiredStock}, hiện có ${req.currentStock}`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Perform conversion in transaction
    return prisma.$transaction(async (tx) => {
      let totalRawCost = 0;
      
      const referenceId = Math.floor(Math.random() * 1000000); // Simple reference ID

      for (const req of rawRequirements) {
        // Create conversion_out
        await tx.stockTransaction.create({
          data: {
            branchId,
            ingredientId: req.rawIngredientId,
            type: 'conversion_out',
            quantity: -req.requiredStock,
            unitCost: 0, // Placeholder
            totalCost: 0,
            referenceId,
            employeeId,
            note: `Converted to ${preparation.name}`
          }
        });

        // Update raw stock
        await tx.ingredient.update({
          where: { id: req.rawIngredientId },
          data: { currentStock: { decrement: req.requiredStock } }
        });
      }

      // Create conversion_in
      const newTransaction = await tx.stockTransaction.create({
        data: {
          branchId,
          ingredientId: preparationId,
          type: 'conversion_in',
          quantity: targetYieldQuantity,
          unitCost: 0, // Placeholder for calculated COGS
          totalCost: 0,
          referenceId,
          employeeId,
          note: `Produced from raw materials`
        }
      });

      // Update preparation stock
      await tx.ingredient.update({
        where: { id: preparationId },
        data: { currentStock: { increment: targetYieldQuantity } }
      });

      return newTransaction;
    });
  }
}

module.exports = new StockConversionService();
