var ingredientRepository = require('../repositories/ingredient.repository');

async function getIngredients(query, user) {
  var filters = {};
  
  // Data Isolation
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');
  
  if (!isOwner) {
    filters.branchId = user.branchId;
  } else if (query.branchId) {
    if (query.branchId === 'global') {
      filters.branchId = null;
    } else {
      filters.branchId = query.branchId;
    }
  } else {
    // When Owner views "Tất cả chi nhánh", only show Global Templates
    filters.branchId = null;
  }

  if (query.search) {
    filters.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } }
    ];
  }

  return ingredientRepository.findIngredients(filters);
}

async function getIngredientById(branchId, id) {
  var ingredient = await ingredientRepository.findIngredientById(id);
  if (!ingredient || ingredient.branchId !== branchId) {
    var err = new Error('Không tìm thấy nguyên liệu');
    err.status = 404;
    throw err;
  }
  return ingredient;
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

  var scope = data.scope || 'specific';
  var branchId = null;
  if (isOwner && scope === 'global') {
    branchId = null;
  } else if (isOwner && data.branchId) {
    branchId = data.branchId;
  } else {
    branchId = user.branchId;
  }

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
    ingredientType: data.ingredientType || 'raw',
    minStockLevel: parseFloat(data.minStockLevel) || 0,
    currentStock: parseFloat(data.currentStock) || 0,
    branchId: branchId,
    isActive: true
  };

  var newIngredient = await ingredientRepository.createIngredient(createData);

  if (branchId === null) {
    var prisma = require('../lib/prisma');
    var branches = await prisma.branch.findMany({ select: { id: true } });
    var localCopies = branches.map(function(b) {
      return {
        name: newIngredient.name,
        sku: newIngredient.sku,
        unit: newIngredient.unit,
        importUnit: newIngredient.importUnit,
        conversionRate: newIngredient.conversionRate,
        category: newIngredient.category,
        ingredientType: newIngredient.ingredientType,
        minStockLevel: newIngredient.minStockLevel,
        currentStock: 0,
        branchId: b.id,
        globalIngredientId: newIngredient.id,
        isActive: true
      };
    });
    if (localCopies.length > 0) {
      await prisma.ingredient.createMany({ data: localCopies });
    }
  }

  return newIngredient;
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
    ingredientType: data.ingredientType !== undefined ? data.ingredientType : existing.ingredientType,
    minStockLevel: data.minStockLevel !== undefined ? parseFloat(data.minStockLevel) : existing.minStockLevel,
    isActive: data.isActive !== undefined ? data.isActive : existing.isActive
  };

  if (isOwner && data.scope) {
    if (existing.globalIngredientId !== null) {
      if (data.scope === 'specific') {
        var errScope = new Error('Đây là bản sao của Nguyên liệu Toàn chuỗi nên không thể chuyển thành Riêng chi nhánh.');
        errScope.status = 400;
        throw errScope;
      }
      // If data.scope is 'global', we just ignore it because it's already a global component's local copy.
    } else {
      if (data.scope === 'global') {
        updateData.branchId = null;
      } else if (data.scope === 'specific') {
        updateData.branchId = data.branchId;
      }
    }
  } else if (isOwner && data.branchId !== undefined) {
    updateData.branchId = data.branchId;
  }

  // Check duplication if name or sku changed
  if (updateData.name !== existing.name || updateData.sku !== existing.sku) {
    var dup = await ingredientRepository.findIngredientByNameOrSku(updateData.name, updateData.sku, existing.branchId);
    if (dup && dup.id !== id) {
      var errDup2 = new Error('Tên nguyên liệu hoặc mã SKU đã tồn tại');
      errDup2.status = 400;
      throw errDup2;
    }
  }

  var updated = await ingredientRepository.updateIngredient(id, updateData);

  if (existing.branchId === null) {
    var prisma = require('../lib/prisma');
    var syncData = {};
    if (updateData.name !== undefined) syncData.name = updateData.name;
    if (updateData.sku !== undefined) syncData.sku = updateData.sku;
    if (updateData.unit !== undefined) syncData.unit = updateData.unit;
    if (updateData.importUnit !== undefined) syncData.importUnit = updateData.importUnit;
    if (updateData.conversionRate !== undefined) syncData.conversionRate = updateData.conversionRate;
    if (updateData.category !== undefined) syncData.category = updateData.category;
    if (updateData.ingredientType !== undefined) syncData.ingredientType = updateData.ingredientType;
    if (updateData.minStockLevel !== undefined) syncData.minStockLevel = updateData.minStockLevel;
    if (updateData.isActive !== undefined) syncData.isActive = updateData.isActive;
    
    await prisma.ingredient.updateMany({
      where: { globalIngredientId: id },
      data: syncData
    });
  }

  // Handle scope transition Specific -> Global
  if (existing.branchId !== null && updateData.branchId === null) {
    var prisma = require('../lib/prisma');
    var branches = await prisma.branch.findMany({ select: { id: true } });
    var localCopies = branches.map(function(b) {
      return {
        name: updated.name,
        sku: updated.sku,
        unit: updated.unit,
        importUnit: updated.importUnit,
        conversionRate: updated.conversionRate,
        category: updated.category,
        ingredientType: updated.ingredientType,
        minStockLevel: updated.minStockLevel,
        currentStock: 0,
        branchId: b.id,
        globalIngredientId: updated.id,
        isActive: true
      };
    });
    if (localCopies.length > 0) {
      await prisma.ingredient.createMany({ data: localCopies });
    }
  }

  // Handle scope transition Global -> Specific
  if (existing.branchId === null && updateData.branchId !== null) {
    var prisma = require('../lib/prisma');
    await prisma.ingredient.updateMany({
      where: { globalIngredientId: id },
      data: { globalIngredientId: null } // Unlink local copies
    });
  }

  return updated;
}

async function getStats(branchId, user) {
  var bId = branchId;
  var roleName = (user.roleName || '').trim().toLowerCase();
  if (!roleName.includes('owner')) {
    bId = user.branchId; // Enforce branch access
  }

  if (!bId) {
    return { totalValue: 0, lowStockCount: 0, receiptsThisMonth: 0 };
  }

  var prisma = require('../lib/prisma');
  
  var ingredients = await prisma.ingredient.findMany({
    where: { branchId: bId }
  });

  var totalValue = 0;
  var lowStockCount = 0;

  for (var ing of ingredients) {
    if (ing.currentStock > 0) {
      totalValue += (ing.currentStock * (ing.unitCost || 0));
    }
    if (ing.currentStock <= (ing.minStockLevel || 0)) {
      lowStockCount++;
    }
  }

  var now = new Date();
  var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  var receiptsThisMonth = await prisma.stockTransaction.count({
    where: {
      branchId: bId,
      type: 'RECEIPT',
      createdAt: { gte: startOfMonth }
    }
  });

  return {
    totalValue: totalValue,
    lowStockCount: lowStockCount,
    receiptsThisMonth: receiptsThisMonth
  };
}

module.exports = {
  getIngredients: getIngredients,
  getIngredientById: getIngredientById,
  createIngredient: createIngredient,
  updateIngredient: updateIngredient,
  getStats: getStats
};
