var shiftService = require('../services/shift.service');

async function getShifts(req, res, next) {
  try {
    var shifts = await shiftService.getShifts(req.query, req.user);
    res.json({ data: shifts });
  } catch (error) {
    next(error);
  }
}

async function createShift(req, res, next) {
  try {
    var shift = await shiftService.createShift(req.body, req.user);
    res.status(201).json({
      data: shift,
      message: 'Shift Saved Successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function updateShift(req, res, next) {
  try {
    var shift = await shiftService.updateShift(req.params.id, req.body, req.user);
    res.json({
      data: shift,
      message: 'Shift Updated Successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function deleteShift(req, res, next) {
  try {
    var result = await shiftService.deleteShift(req.params.id, req.user);
    res.json({
      data: result.shift,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getShifts: getShifts,
  createShift: createShift,
  updateShift: updateShift,
  deleteShift: deleteShift
};
