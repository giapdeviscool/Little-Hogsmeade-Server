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

  if (isOwner) {
    // Owner creates for all branches (global) or can specify branchId if needed
    branchId = data.branchId || null;
  } else if (isAdmin) {
    branchId = user.branchId;
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

module.exports = {
  getMenuItems: getMenuItems,
  createMenuItem: createMenuItem,
  updateMenuItemStatus: updateMenuItemStatus
};
