var stockTransactionService = require('../services/stock-transaction.service');

async function createGoodsReceipt(req, res, next) {
  try {
    var result = await stockTransactionService.createGoodsReceipt(req.body, req.user);
    res.status(201).json({
      data: result,
      message: 'Goods Receipt created successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function createGoodsIssue(req, res, next) {
  try {
    var result = await stockTransactionService.createGoodsIssue(req.body, req.user);
    res.status(201).json({
      data: result,
      message: 'Goods Issue created successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function getStockLedger(req, res, next) {
  try {
    var branchId = req.query.branchId;
    var ingredientId = req.query.ingredientId;
    var startDate = req.query.startDate;
    var endDate = req.query.endDate;
    
    var result = await stockTransactionService.getStockLedger(branchId, ingredientId, startDate, endDate, req.user);
    res.status(200).json({
      data: result,
      message: 'Stock ledger retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createGoodsReceipt: createGoodsReceipt,
  createGoodsIssue: createGoodsIssue,
  getStockLedger: getStockLedger
};
