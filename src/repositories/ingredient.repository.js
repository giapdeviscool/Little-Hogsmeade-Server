var prisma = require('../lib/prisma');

async function findIngredients(filters) {
  return prisma.ingredient.findMany({
    where: filters,
    orderBy: { name: 'asc' }
  });
}

async function findIngredientById(id) {
  return prisma.ingredient.findUnique({
    where: { id: id },
    include: {
      recipes: {
        take: 1
      }
    }
  });
}

async function findIngredientByNameOrSku(name, sku, branchId) {
  var OR = [{ name: name }];
  if (sku) {
    OR.push({ sku: sku });
  }
  return prisma.ingredient.findFirst({
    where: {
      branchId: branchId,
      OR: OR
    }
  });
}

async function createIngredient(data) {
  return prisma.ingredient.create({
    data: data
  });
}

async function updateIngredient(id, data) {
  return prisma.ingredient.update({
    where: { id: id },
    data: data
  });
}

module.exports = {
  findIngredients: findIngredients,
  findIngredientById: findIngredientById,
  findIngredientByNameOrSku: findIngredientByNameOrSku,
  createIngredient: createIngredient,
  updateIngredient: updateIngredient
};
