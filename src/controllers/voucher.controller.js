var voucherService = require("../services/voucher.service");

async function validateVoucher(req, res, next) {
  try {
    var code = req.body.code;
    var orderSubtotal = req.body.orderSubtotal || 0;
    var customerId = req.body.customerId;
    var branchId = req.user && req.user.branchId;

    if (!code) {
      return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp mã Voucher' });
    }

    var result = await voucherService.validateVoucher(code, orderSubtotal, customerId, branchId);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
}

async function getCustomerVouchers(req, res, next) {
  try {
    var customerId = req.params.customerId;
    var vouchers = await voucherService.getCustomerVouchers(customerId);
    res.json({
      status: 'success',
      data: vouchers
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateVoucher,
  getCustomerVouchers
};
