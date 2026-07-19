var express = require('express');
var voucherController = require('../controllers/voucher.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);

router.post('/validate', voucherController.validateVoucher);
router.get('/customer/:customerId', voucherController.getCustomerVouchers);

module.exports = router;
