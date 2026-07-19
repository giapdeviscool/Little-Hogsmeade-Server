const expenseService = require('../services/expense.service');

async function getExpenseCategories(req, res, next) {
  try {
    const categories = await expenseService.getExpenseCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

async function createExpenseCategory(req, res, next) {
  try {
    // Accept both old format { name, type } and new { name, costType, isSystem, branchId }
    const category = await expenseService.createExpenseCategory(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

async function updateExpenseCategory(req, res, next) {
  try {
    const { id } = req.params;
    const category = await expenseService.updateExpenseCategory(id, req.body);
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

async function deleteExpenseCategory(req, res, next) {
  try {
    const { id } = req.params;
    await expenseService.deleteExpenseCategory(id);
    res.json({ success: true, message: 'Đã xóa danh mục' });
  } catch (error) {
    next(error);
  }
}

async function getExpenses(req, res, next) {
  try {
    const { branchId, startDate, endDate } = req.query;
    const expenses = await expenseService.getExpenses(branchId, { startDate, endDate });
    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
}

async function createExpense(req, res, next) {
  try {
    const employeeId = req.user.id;
    const expense = await expenseService.createExpense(req.body, employeeId);
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const { id } = req.params;
    await expenseService.deleteExpense(id);
    res.json({ success: true, message: 'Đã xóa phiếu chi' });
  } catch (error) {
    next(error);
  }
}

async function getFinancialSummary(req, res, next) {
  try {
    const { branchId, startDate, endDate } = req.query;
    const summary = await expenseService.getFinancialSummary(branchId, { startDate, endDate });
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  getExpenses,
  createExpense,
  deleteExpense,
  getFinancialSummary
};
