var prisma = require('../lib/prisma');

async function processOrderStockDeduction(orderId, txClient) {
  var tx = txClient || prisma;
  var order = await tx.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: {
        include: {
          menuItem: {
            include: {
              recipes: {
                include: { ingredient: true }
              }
            }
          },
          orderItemToppings: {
            include: {
              topping: {
                include: { ingredient: true }
              }
            }
          }
        }
      }
    }
  });

  if (!order) return;
  var branchId = order.branchId;

  // A map to accumulate deductions. Key: local ingredient ID, Value: total quantity to deduct
  var deductions = {};
  // A map to keep track of local ingredient records so we can update them
  var localIngredients = {};

  async function getLocalIngredient(ingredient) {
    if (!ingredient) return null;
    if (ingredient.branchId) {
      // It is already a local ingredient
      return ingredient;
    }
    // It is a global ingredient, find the local one
    var localIng = await tx.ingredient.findFirst({
      where: {
        globalIngredientId: ingredient.id,
        branchId: branchId
      }
    });
    return localIng;
  }

  function addDeduction(localIng, amount) {
    if (!localIng) return;
    if (!deductions[localIng.id]) {
      deductions[localIng.id] = 0;
      localIngredients[localIng.id] = localIng;
    }
    deductions[localIng.id] += amount;
  }

  for (var i = 0; i < order.orderItems.length; i++) {
    var orderItem = order.orderItems[i];
    var quantity = orderItem.quantity;

    // 1. Deduct MenuItem recipes
    if (orderItem.menuItem && orderItem.menuItem.recipes) {
      for (var j = 0; j < orderItem.menuItem.recipes.length; j++) {
        var recipe = orderItem.menuItem.recipes[j];
        var amountToDeduct = recipe.quantityRequired * quantity;
        var localIng = await getLocalIngredient(recipe.ingredient);
        addDeduction(localIng, amountToDeduct);
      }
    }

    // 2. Deduct Toppings
    if (orderItem.orderItemToppings) {
      for (var k = 0; k < orderItem.orderItemToppings.length; k++) {
        var itemTopping = orderItem.orderItemToppings[k];
        var topping = itemTopping.topping;
        if (topping && topping.ingredientId && topping.quantityRequired) {
          var amountToDeduct = topping.quantityRequired * itemTopping.quantity;
          var localIngTopping = await getLocalIngredient(topping.ingredient);
          addDeduction(localIngTopping, amountToDeduct);
        }
      }
    }
  }

  // Perform deductions and create StockTransaction records
  var ingIds = Object.keys(deductions);
  for (var idx = 0; idx < ingIds.length; idx++) {
    var ingId = ingIds[idx];
    var deductAmount = deductions[ingId];
    
    // Check current stock (could throw error if strict hard limit BR-INV19 applies, 
    // but for sales, usually we allow negative stock or just deduct it anyway so POS is not blocked)
    // Here we will just deduct it.
    
    await tx.ingredient.update({
      where: { id: ingId },
      data: {
        currentStock: {
          decrement: deductAmount
        }
      }
    });

    await tx.stockTransaction.create({
      data: {
        branchId: branchId,
        ingredientId: ingId,
        type: 'SALE',
        quantity: deductAmount,
        unitCost: 0, // could map to real cost if needed
        totalCost: 0,
        employeeId: order.employeeId || null,
        note: 'Bán hàng - Mã đơn: ' + orderId
      }
    });
  }
}

module.exports = {
  processOrderStockDeduction
};
