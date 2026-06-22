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

module.exports = {
  getCategories: getCategories,
  createCategory: createCategory,
  updateCategory: updateCategory,
  deleteCategory: deleteCategory
};
