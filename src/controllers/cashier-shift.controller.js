var cashierShiftService = require('../services/cashier-shift.service');

async function openShift(req, res, next) {
  try {
    var branchId = req.user && req.user.branchId;
    var employeeId = req.user && req.user.id;
    var result = await cashierShiftService.openShift(branchId, employeeId, req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function checkActiveShift(req, res, next) {
  try {
    var branchId = req.user && req.user.branchId;
    var result = await cashierShiftService.checkActiveShift(branchId);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function requestClosure(req, res, next) {
  try {
    var shiftId = req.params.id;
    var branchId = req.user && req.user.branchId;
    var result = await cashierShiftService.requestClosure(shiftId, branchId);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function closeShift(req, res, next) {
  try {
    var shiftId = req.params.id;
    var branchId = req.user && req.user.branchId;
    var currentUser = req.user;
    var result = await cashierShiftService.closeShift(shiftId, branchId, req.body, currentUser);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  openShift: openShift,
  checkActiveShift: checkActiveShift,
  requestClosure: requestClosure,
  closeShift: closeShift
};
