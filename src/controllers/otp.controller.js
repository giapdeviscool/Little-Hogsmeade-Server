var prisma = require('../lib/prisma');
var otpService = require('../services/otp.service');

async function setup2FA(req, res, next) {
  try {
    var result = await otpService.setup2FA(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function verify2FA(req, res, next) {
  try {
    var result = await otpService.verify2FA(req.user.id, req.body.code);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function get2FAStatus(req, res, next) {
  try {
    var targetEmployeeId = req.query.employeeId || null;
    var result = await otpService.get2FAStatus(req.user.id, targetEmployeeId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  setup2FA: setup2FA,
  verify2FA: verify2FA,
  get2FAStatus: get2FAStatus
};
