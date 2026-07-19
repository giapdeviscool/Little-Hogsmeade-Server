var menuItemRepository = require('../repositories/menu-item.repository');

async function getMenuItems(query, user) {
  var page = parseInt(query.page, 10) || 1;
  var limit = parseInt(query.limit, 10) || 10;
  var skip = (page - 1) * limit;

  var filters = {};

  // Role-based data isolation
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin') || roleName.includes('manager');
  var isCashier = roleName.includes('cashier');

  if (isOwner) {
    // Owner sees all, or can filter by branchId explicitly if passed
    if (query.branchId) {
      filters.branchId = query.branchId;
    }
  } else if (isAdmin || isCashier) {
    // See global items (branchId: null) or their branch items
    filters.OR = [
      { branchId: null },
      { branchId: user.branchId }
    ];
  } else {
    // Any other role probably shouldn't see menu setup, but let's default to branch only
    filters.branchId = user.branchId;
  }

  // Search by name
  if (query.search) {
    filters.name = {
      contains: query.search,
      mode: 'insensitive'
    };
  }

  // Filter by category
  if (query.categoryId) {
    filters.categoryId = query.categoryId;
  }

  // Filter by status
  if (query.status !== undefined && query.status !== '') {
    filters.isActive = query.status === 'true';
  }

  var total = await menuItemRepository.countMenuItems(filters);
  var items = await menuItemRepository.findMenuItems(filters, skip, limit);

  return {
    items: items,
    pagination: {
      total: total,
      page: page,
      limit: limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function createMenuItem(data, user, fileUrl) {
  if (!data.name || !data.categoryId || !data.basePrice) {
    var err = new Error('Thiếu trường bắt buộc (name, categoryId, basePrice)');
    err.status = 400;
    throw err;
  }

  var price = parseFloat(data.basePrice);
  if (isNaN(price) || price <= 0) {
    var errPrice = new Error('Giá bán phải lớn hơn 0');
    errPrice.status = 400;
    throw errPrice;
  }

  // Check duplicate
  var existing = await menuItemRepository.findMenuItemByNameAndCategory(data.name, data.categoryId);
  if (existing) {
    var errDup = new Error('Tên món đã tồn tại trong danh mục này');
    errDup.status = 409;
    throw errDup;
  }

  var branchId = null;
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin') || roleName.includes('manager');

  // Treat empty string as explicit global request
  var rawBranchId = data.branchId

  if (rawBranchId === '') {
    branchId = null
  } else if (isOwner) {
    // Owner creates for all branches (global) or can specify branchId if needed
    branchId = rawBranchId || null
  } else if (isAdmin) {
    // Admin can create branch-specific items; if no branchId supplied, fall back to user's branch
    branchId = rawBranchId || user.branchId || null
  } else {
    var errRole = new Error('Không có quyền tạo món ăn');
    errRole.status = 403;
    throw errRole;
  }

  var itemData = {
    name: data.name,
    categoryId: data.categoryId,
    basePrice: price,
    description: data.description || null,
    imageUrl: fileUrl || data.imageUrl || null,
    branchId: branchId,
    isActive: false, // BR-MM15: Default Initialization Status
    itemType: 'food', // Defaulting itemType
    isFeatured: false
  };

  return await menuItemRepository.createMenuItem(itemData);
}

async function updateMenuItemStatus(id, isActive, user) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin') || roleName.includes('manager');
  var isCashier = roleName.includes('cashier');

  if (!isOwner && !isAdmin && !isCashier) {
    var errRole = new Error('Không có quyền cập nhật trạng thái món ăn');
    errRole.status = 403;
    throw errRole;
  }

  var item = await menuItemRepository.findMenuItemById(id);
  if (!item) {
    var errNotFound = new Error('Không tìm thấy món ăn');
    errNotFound.status = 404;
    throw errNotFound;
  }

  if (isAdmin || isCashier) {
    if (item.branchId !== null && item.branchId !== user.branchId) {
      var errBranch = new Error('Không có quyền cập nhật món ăn của chi nhánh khác');
      errBranch.status = 403;
      throw errBranch;
    }
  }

  if (isActive === true) {
    var recipeCount = await menuItemRepository.countRecipesForMenuItem(id);
    if (recipeCount === 0) {
      var errBOM = new Error('Cannot activate item. Please configure the ingredient recipe (BOM) for this item before making it available for sale.');
      errBOM.status = 400;
      throw errBOM;
    }
  }

  return await menuItemRepository.updateMenuItemStatus(id, isActive);
}

async function updateMenuItem(id, data, user, fileUrl) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');
  var isAdmin = roleName.includes('chain admin') || roleName.includes('admin') || roleName.includes('manager');

  if (!isOwner && !isAdmin) {
    var errRole = new Error('Không có quyền cập nhật món ăn');
    errRole.status = 403;
    throw errRole;
  }

  var item = await menuItemRepository.findMenuItemById(id);
  if (!item) {
    var errNotFound = new Error('Không tìm thấy món ăn');
    errNotFound.status = 404;
    throw errNotFound;
  }

  if (isAdmin) {
    if (item.branchId !== null && item.branchId !== user.branchId) {
      var errBranch = new Error('Không có quyền cập nhật món ăn của chi nhánh khác');
      errBranch.status = 403;
      throw errBranch;
    }
  }

  var itemData = {};

  if (data.name) {
    // Check duplicate if name or category changed
    var targetCategoryId = data.categoryId || item.categoryId;
    var existing = await menuItemRepository.findMenuItemByNameAndCategory(data.name, targetCategoryId);
    if (existing && existing.id !== id) {
      var errDup = new Error('Tên món đã tồn tại trong danh mục này');
      errDup.status = 409;
      throw errDup;
    }
    itemData.name = data.name;
  }

  if (data.categoryId) itemData.categoryId = data.categoryId;
  
  if (data.basePrice !== undefined) {
    var price = parseFloat(data.basePrice);
    if (isNaN(price) || price <= 0) {
      var errPrice = new Error('Giá bán phải lớn hơn 0');
      errPrice.status = 400;
      throw errPrice;
    }
    itemData.basePrice = price;
  }

  if (data.description !== undefined) itemData.description = data.description;
  if (fileUrl) itemData.imageUrl = fileUrl;

  return await menuItemRepository.updateMenuItem(id, itemData);
}

async function moveItemsToCategory(menuItemIds, categoryId, user) {
  var roleName = (user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');

  if (!isOwner) {
    var errRole = new Error('Chỉ Owner mới có quyền chuyển món giữa các danh mục');
    errRole.status = 403;
    throw errRole;
  }

  if (!Array.isArray(menuItemIds) || menuItemIds.length === 0 || !categoryId) {
    var errParams = new Error('Thiếu tham số menuItemIds hoặc categoryId');
    errParams.status = 400;
    throw errParams;
  }

  // Check if category exists
  var categoryRepository = require('../repositories/category.repository');
  var category = await categoryRepository.findCategoryById(categoryId);
  if (!category) {
    var errNotFound = new Error('Danh mục không tồn tại');
    errNotFound.status = 404;
    throw errNotFound;
  }

  return await menuItemRepository.moveItemsToCategory(menuItemIds, categoryId);
}

module.exports = {
  getMenuItems: getMenuItems,
  createMenuItem: createMenuItem,
  updateMenuItemStatus: updateMenuItemStatus,
  updateMenuItem: updateMenuItem,
  moveItemsToCategory: moveItemsToCategory
};
