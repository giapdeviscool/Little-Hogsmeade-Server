var categoryService = require('../services/category.service');

async function getCategories(req, res, next) {
  try {
    var result = await categoryService.getCategories(req.query || {}, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    var result = await categoryService.createCategory(req.body, req.user);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    var result = await categoryService.updateCategory(req.params.id, req.body, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    var result = await categoryService.deleteCategory(req.params.id, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function moveCategory(req, res, next) {
  try {
    var direction = req.body.direction; // 'up' or 'down'
    var id = req.params.id;
    var result = await categoryService.swapDisplayOrder(id, direction, req.user);
    res.json({ message: 'Category moved successfully', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = {
  getCategories: getCategories,
  createCategory: createCategory,
  updateCategory: updateCategory,
  deleteCategory: deleteCategory,
  moveCategory: moveCategory
};
