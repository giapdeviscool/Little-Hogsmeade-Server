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

  // Filter by branch jurisdiction
  // Wait, UC states global menu categories or localized branch overrides
  // Currently, we will show global categories (branchId: null) or categories specific to the user's branch
  if (query.branchId) {
    filters.branchId = query.branchId;
  } else if (user && user.branchId) {
    // If the user belongs to a branch, maybe show branch specific OR global
    // But since it's a centralized catalog, typically we'd show all if it's chain admin, or just the branch's categories.
    // We will support an exact match if provided, otherwise default to all or branch-specific
    filters.OR = [
      { branchId: user.branchId },
      { branchId: null }
    ];
  } else {
    // Global only
    filters.branchId = null;
  }

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

  // Determine branchId
  var branchId = null;
  if (user.role.name === 'Owner') {
    branchId = payload.branchId || null;
  } else if (user.role.name === 'Chain Admin') {
    branchId = payload.branchId || user.branchId || null;
  } else {
    throw { status: 403, message: 'Forbidden' };
  }

  // Check unique name
  var existing = await categoryRepository.findCategoryByName(payload.name, branchId);
  if (existing) {
    throw { status: 400, message: 'A category with this name already exists. Please choose a different name.' };
  }

  // Append to the end by getting current max displayOrder
  var maxOrderCategory = await categoryRepository.findCategories({ branchId: branchId }, 0, 1);
  var nextDisplayOrder = 0;
  if (maxOrderCategory && maxOrderCategory.length > 0) {
    // We need the absolute max, the repo query might just be sorting.
    // Let's just do a count or rely on the total count.
    var totalCategories = await categoryRepository.countCategories({ branchId: branchId });
    nextDisplayOrder = totalCategories;
  }

  return categoryRepository.createCategory({
    name: payload.name,
    icon: payload.icon || null,
    displayOrder: nextDisplayOrder,
    isActive: payload.isActive !== undefined ? payload.isActive : true,
    branchId: branchId
  });
}

async function updateCategory(id, payload, user) {
  var category = await categoryRepository.findCategoryById(id);
  if (!category) {
    throw { status: 404, message: 'Category not found' };
  }

  // Check unique name if changing
  if (payload.name && payload.name !== category.name) {
    var existing = await categoryRepository.findCategoryByName(payload.name, category.branchId, id);
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
  if (payload.icon !== undefined) updateData.icon = payload.icon;
  // Ignore displayOrder updates from general update
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
  // Soft delete
  return updateCategory(id, { isActive: false }, user);
}

module.exports = {
  getCategories: getCategories,
  createCategory: createCategory,
  updateCategory: updateCategory,
  deleteCategory: deleteCategory,
  swapDisplayOrder: swapDisplayOrder
};
