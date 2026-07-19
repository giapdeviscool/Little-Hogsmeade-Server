var categoryRepository = require('../repositories/category.repository');

async function getCategories(query, user) {
  var page = parseInt(query.page, 10) || 1;
  var limit = parseInt(query.limit, 10) || 10;
  var skip = (page - 1) * limit;
  var filters = {};

  // Search by name
  if (query.search) {
    filters.name = {
      contains: query.search,
      mode: 'insensitive'
    };
  }

  // Filter by status (active/inactive)
  if (query.status) {
    filters.isActive = query.status === 'active';
  }

  // Categories now always global — no branchId filtering

  var [items, total] = await Promise.all([
    categoryRepository.findCategories(filters, skip, limit),
    categoryRepository.countCategories(filters)
  ]);

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

async function createCategory(payload, user) {
  if (!payload.name) {
    throw { status: 400, message: 'Category name is required' };
  }

  // Check unique name (global)
  var existing = await categoryRepository.findCategoryByName(payload.name, null);
  if (existing) {
    throw { status: 400, message: 'A category with this name already exists. Please choose a different name.' };
  }

  // Append to the end
  var totalCategories = await categoryRepository.countCategories({});
  var nextDisplayOrder = totalCategories;

  return categoryRepository.createCategory({
    name: payload.name,
    displayOrder: nextDisplayOrder,
    isActive: payload.isActive !== undefined ? payload.isActive : true
  });
}

async function updateCategory(id, payload, user) {
  var category = await categoryRepository.findCategoryById(id);
  if (!category) {
    throw { status: 404, message: 'Category not found' };
  }

  // Check unique name if changing
  if (payload.name && payload.name !== category.name) {
    var existing = await categoryRepository.findCategoryByName(payload.name, null, id);
    if (existing) {
      throw { status: 400, message: 'A category with this name already exists. Please choose a different name.' };
    }
  }

  // Check if trying to deactivate
  if (payload.isActive === false && category.isActive === true) {
    if (category._count && category._count.menuItems > 0) {
      throw { status: 400, message: 'This category contains active menu items. Please reassign or disable those items before deactivating the category.' };
    }
  }

  var updateData = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

  return categoryRepository.updateCategory(id, updateData);
}

async function swapDisplayOrder(id, direction, user) {
  var roleName = (user.roleName || user.role?.name || '').trim().toLowerCase();
  var isOwner = roleName.includes('owner');

  if (!isOwner) {
    var errRole = new Error('Chỉ Owner mới có quyền thay đổi thứ tự danh mục');
    errRole.status = 403;
    throw errRole;
  }

  if (direction !== 'up' && direction !== 'down') {
    var errParams = new Error('Tham số direction phải là up hoặc down');
    errParams.status = 400;
    throw errParams;
  }

  return await categoryRepository.swapDisplayOrder(id, direction);
}

async function deleteCategory(id, user) {
  return updateCategory(id, { isActive: false }, user);
}

module.exports = {
  getCategories: getCategories,
  createCategory: createCategory,
  updateCategory: updateCategory,
  deleteCategory: deleteCategory,
  swapDisplayOrder: swapDisplayOrder
};
