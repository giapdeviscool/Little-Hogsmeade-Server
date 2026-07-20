var recipeRepository = require('../repositories/recipe.repository');

async function getRecipes(query, user) {
  var page = parseInt(query.page, 10) || 1;
  var limit = parseInt(query.limit, 10) || 10;
  var skip = (page - 1) * limit;

  var filters = {};

  // BR-BOM02: Strict Data Isolation
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin');
  var isStaff = roleName.includes('staff') || roleName.includes('cashier');

  if (isOwner) {
    if (query.branchId) {
      filters.menuItem = { branchId: query.branchId };
    }
  } else if (isAdmin || isStaff) {
    // Both Admin and Staff can only see recipes mapped to their branch (or global items if applicable)
    // Actually, recipes might be tied to specific branch ingredients, but we filter by menu item's branch or ingredient's branch.
    // Let's filter by ingredient branchId, since recipes use ingredients from the branch.
    filters.ingredient = { branchId: user.branchId };
  } else {
    var errRole = new Error('Không có quyền xem công thức');
    errRole.status = 403;
    throw errRole;
  }

  // Filter by Menu Item Name
  if (query.search) {
    filters.menuItem = filters.menuItem || {};
    filters.menuItem.name = {
      contains: query.search,
      mode: 'insensitive'
    };
  }

  // Filter by Ingredient ID
  if (query.ingredientId) {
    filters.ingredientId = query.ingredientId;
  }

  var total = await recipeRepository.countRecipes(filters);
  var rawRecipes = await recipeRepository.findRecipes(filters, skip, limit);

  // BR-BOM01: Role-Based Financial Masking
  // Strip financial data if user is purely Staff
  var shouldMaskFinancials = isStaff && !isAdmin && !isOwner;

  var formattedRecipes = rawRecipes.map(function(recipe) {
    var result = {
      id: recipe.id,
      menuItemId: recipe.menuItemId,
      menuItemName: recipe.menuItem ? recipe.menuItem.name : 'N/A',
      variantId: recipe.variantId,
      variantName: recipe.variant ? recipe.variant.name : null,
      ingredientId: recipe.ingredientId,
      ingredientName: recipe.ingredient ? recipe.ingredient.name : 'N/A',
      ingredientType: recipe.ingredient ? recipe.ingredient.ingredientType : 'raw',
      unit: recipe.ingredient ? recipe.ingredient.unit : 'N/A',
      quantityRequired: recipe.quantityRequired,
      isIngredientActive: recipe.ingredient && typeof recipe.ingredient.isActive !== 'undefined' ? recipe.ingredient.isActive : true
    };

    if (!shouldMaskFinancials && recipe.ingredient) {
      // Typically ingredient might have unitCost or currentStock etc.
      // If there's financial data, include it here.
      // For now, we just pass unitCost if we had it, but Ingredient only has minStockLevel and currentStock.
      // If cost data is added later, it goes here.
      result.currentStock = recipe.ingredient.currentStock;
    }

    return result;
  });

  return {
    items: formattedRecipes,
    pagination: {
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

var prisma = require('../lib/prisma');

async function setMenuItemRecipes(menuItemId, variantId, recipes, user) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin');
  var isOwner = roleName.includes('owner');

  if (!isAdmin && !isOwner) {
    var errRole = new Error('Chỉ Owner hoặc Chain Admin mới có thể cấu hình công thức');
    errRole.status = 403;
    throw errRole;
  }

  // Find menuItem
  var menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId }
  });

  if (!menuItem) {
    var errNotFound = new Error('Không tìm thấy món ăn');
    errNotFound.status = 404;
    throw errNotFound;
  }

  // BR-BOM07: Chain Admin cannot edit global recipes
  if (isAdmin && !isOwner && !menuItem.branchId) {
    var errGlobal = new Error('Chain Admin không được phép chỉnh sửa công thức của món ăn toàn hệ thống');
    errGlobal.status = 403;
    throw errGlobal;
  }

  // Validate quantities
  for (var i = 0; i < recipes.length; i++) {
    var r = recipes[i];
    if (!r.ingredientId) {
      var errIngId = new Error('Mã nguyên liệu không hợp lệ');
      errIngId.status = 400;
      throw errIngId;
    }
    if (typeof r.quantityRequired !== 'number' || r.quantityRequired <= 0) {
      var errQty = new Error('Số lượng tiêu hao phải là số dương lớn hơn 0');
      errQty.status = 400;
      throw errQty;
    }
  }

  // Save via repository
  await recipeRepository.saveMenuItemRecipes(menuItemId, variantId, recipes);

  return { message: 'Cấu hình công thức thành công' };
}

module.exports = {
  getRecipes: getRecipes,
  setMenuItemRecipes: setMenuItemRecipes
};
