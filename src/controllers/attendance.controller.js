var attendanceService = require('../services/attendance.service');

async function checkIn(req, res, next) {
  try {
    var result = await attendanceService.checkIn(req.body);
    res.status(201).json({
      data: result,
      message: 'Check-in Successful at ' + result.timestamp.toLocaleTimeString()
    });
  } catch (error) {
    next(error);
  }
}

async function checkOut(req, res, next) {
  try {
    var result = await attendanceService.checkOut(req.body);
    res.json({
      data: result,
      message: 'Check-out Successful at ' + result.timestamp.toLocaleTimeString()
    });
  } catch (error) {
    next(error);
  }
}

async function getTodayAttendance(req, res, next) {
  try {
    var records = await attendanceService.getTodayAttendance(req.query, req.user);
    res.json({ data: records });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkIn: checkIn,
  checkOut: checkOut,
  getTodayAttendance: getTodayAttendance
};
