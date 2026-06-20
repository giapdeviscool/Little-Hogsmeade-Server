var menuItemRepository = require('../repositories/menu-item.repository');

async function getMenuItems(query, user) {
  var page = parseInt(query.page, 10) || 1;
  var limit = parseInt(query.limit, 10) || 10;
  var skip = (page - 1) * limit;

  var filters = {};

  // Role-based data isolation
  var roleName = user.roleName || '';
  if (roleName === 'Owner') {
    // Owner sees all, or can filter by branchId explicitly if passed
    if (query.branchId) {
      filters.branchId = query.branchId;
    }
  } else if (roleName === 'Chain Admin' || roleName === 'Cashier') {
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
  var roleName = user.roleName || '';
  if (roleName === 'Owner') {
    // Owner creates for all branches (global) or can specify branchId if needed
    branchId = data.branchId || null;
  } else if (roleName === 'Chain Admin') {
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

module.exports = {
  getMenuItems: getMenuItems,
  createMenuItem: createMenuItem
};
