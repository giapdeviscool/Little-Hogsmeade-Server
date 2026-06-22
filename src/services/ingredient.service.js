var ingredientRepository = require('../repositories/ingredient.repository');

async function getIngredients(query, user) {
  var filters = {};
  
  // Data Isolation
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');
  
  if (!isOwner) {
    filters.branchId = user.branchId;
  } else if (query.branchId) {
    filters.branchId = query.branchId;
  }

  if (query.search) {
    filters.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } }
    ];
  }

  return ingredientRepository.findIngredients(filters);
}

async function createIngredient(data, user) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin') || roleName.includes('manager');
  var isOwner = roleName.includes('owner');

  if (!isAdmin && !isOwner) {
    var errRole = new Error('Không có quyền thêm nguyên liệu');
    errRole.status = 403;
    throw errRole;
  }

  var branchId = isOwner && data.branchId ? data.branchId : user.branchId;

  // Validation: Check duplicate name or sku
  var existing = await ingredientRepository.findIngredientByNameOrSku(data.name, data.sku, branchId);
  if (existing) {
    var errDup = new Error('Tên nguyên liệu hoặc mã SKU đã tồn tại');
    errDup.status = 400;
    throw errDup;
  }

  var createData = {
    name: data.name,
    sku: data.sku || null,
    unit: data.unit,
    importUnit: data.importUnit || null,
    conversionRate: parseFloat(data.conversionRate) || 1.0,
    category: data.category || null,
    minStockLevel: parseFloat(data.minStockLevel) || 0,
    currentStock: parseFloat(data.currentStock) || 0,
    branchId: branchId,
    isActive: true
  };

  return ingredientRepository.createIngredient(createData);
}

async function updateIngredient(id, data, user) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin') || roleName.includes('manager');
  var isOwner = roleName.includes('owner');

  if (!isAdmin && !isOwner) {
    var errRole = new Error('Không có quyền sửa nguyên liệu');
    errRole.status = 403;
    throw errRole;
  }

  var existing = await ingredientRepository.findIngredientById(id);
  if (!existing) {
    var errNotFound = new Error('Không tìm thấy nguyên liệu');
    errNotFound.status = 404;
    throw errNotFound;
  }

  if (!isOwner && existing.branchId !== user.branchId) {
    var errBranch = new Error('Không có quyền sửa nguyên liệu của chi nhánh khác');
    errBranch.status = 403;
    throw errBranch;
  }

  // Check if trying to change Recipe Unit while used in recipes
  if (data.unit && data.unit !== existing.unit) {
    if (existing.recipes && existing.recipes.length > 0) {
      var errUnit = new Error('Cannot change the Recipe Unit because this material is actively used in recipes. Please update the recipes first before altering the base unit.');
      errUnit.status = 400;
      throw errUnit;
    }
  }

  var updateData = {
    name: data.name !== undefined ? data.name : existing.name,
    sku: data.sku !== undefined ? data.sku : existing.sku,
    unit: data.unit !== undefined ? data.unit : existing.unit,
    importUnit: data.importUnit !== undefined ? data.importUnit : existing.importUnit,
    conversionRate: data.conversionRate !== undefined ? parseFloat(data.conversionRate) : existing.conversionRate,
    category: data.category !== undefined ? data.category : existing.category,
    minStockLevel: data.minStockLevel !== undefined ? parseFloat(data.minStockLevel) : existing.minStockLevel,
    isActive: data.isActive !== undefined ? data.isActive : existing.isActive
  };

  // Check duplication if name or sku changed
  if (updateData.name !== existing.name || updateData.sku !== existing.sku) {
    var dup = await ingredientRepository.findIngredientByNameOrSku(updateData.name, updateData.sku, existing.branchId);
    if (dup && dup.id !== id) {
      var errDup2 = new Error('Tên nguyên liệu hoặc mã SKU đã tồn tại');
      errDup2.status = 400;
      throw errDup2;
    }
  }

  return ingredientRepository.updateIngredient(id, updateData);
}

module.exports = {
  getIngredients: getIngredients,
  createIngredient: createIngredient,
  updateIngredient: updateIngredient
};
