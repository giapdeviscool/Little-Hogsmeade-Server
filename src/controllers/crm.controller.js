var crmCustomerService = require('../services/crm-customer.service');

async function getCustomers(req, res, next) {
  try {
    var result = await crmCustomerService.getCustomers(req.user, req.query || {});
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCustomers: getCustomers
};
