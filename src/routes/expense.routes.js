const express = require('express');
const expenseController = require('../controllers/expense.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

// UC83 & UC85: Expense Management
router.get('/summary', expenseController.getFinancialSummary);

router.get('/categories', expenseController.getExpenseCategories);
router.post('/categories', expenseController.createExpenseCategory);
router.put('/categories/:id', expenseController.updateExpenseCategory);
router.delete('/categories/:id', expenseController.deleteExpenseCategory);

router.get('/', expenseController.getExpenses);
router.post('/', expenseController.createExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
