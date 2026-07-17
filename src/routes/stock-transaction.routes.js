var express = require('express');
var router = express.Router();
var stockTransactionController = require('../controllers/stock-transaction.controller');
var authMiddleware = require('../middlewares/auth.middleware');

// UC78: Create Goods Receipt (Nhập kho)
router.post('/receipt', authMiddleware.authenticate, stockTransactionController.createGoodsReceipt);

// UC79: Create Goods Issue (Xuất/Hủy kho)
router.post('/issue', authMiddleware.authenticate, stockTransactionController.createGoodsIssue);

// UC82: View Stock Ledger (Thẻ Kho)
router.get('/ledger', authMiddleware.authenticate, stockTransactionController.getStockLedger);

module.exports = router;
