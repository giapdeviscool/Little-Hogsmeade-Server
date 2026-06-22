var prisma = require('../lib/prisma');

async function countRecipes(filters) {
  return prisma.recipe.count({
    where: filters
  });
}

async function findRecipes(filters, skip, limit) {
  return prisma.recipe.findMany({
    where: filters,
    skip: skip,
    take: limit,
    include: {
      menuItem: true,
      ingredient: true,
      variant: true
    },
    orderBy: {
      menuItemId: 'asc'
    }
  });
}

async function saveMenuItemRecipes(menuItemId, variantId, recipesArray) {
  var whereClause = { menuItemId: menuItemId };
  if (variantId) {
    whereClause.variantId = variantId;
  } else {
    // If no variantId is provided, we assume we are updating the base recipe.
    // In our schema variantId is optional.
    whereClause.variantId = null;
  }

  var createData = recipesArray.map(function(r) {
    return {
      menuItemId: menuItemId,
      variantId: variantId || null,
      ingredientId: r.ingredientId,
      quantityRequired: r.quantityRequired
    };
  });

  return prisma.$transaction([
    prisma.recipe.deleteMany({
      where: whereClause
    }),
    prisma.recipe.createMany({
      data: createData
    })
  ]);
}

module.exports = {
  countRecipes: countRecipes,
  findRecipes: findRecipes,
  saveMenuItemRecipes: saveMenuItemRecipes
};
