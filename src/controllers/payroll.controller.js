var payrollService = require('../services/payroll.service');

async function getPayroll(req, res, next) {
  try {
    var payroll = await payrollService.getPayroll(req.query, req.user);
    res.json({ data: payroll });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPayroll: getPayroll
};
