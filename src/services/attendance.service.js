var bcrypt = require('bcryptjs');
var attendanceRepository = require('../repositories/attendance.repository');
var authMiddleware = require('../middlewares/auth.middleware');

// ──────────────────────────────────────────────
// UC61 – Record attendance
// ──────────────────────────────────────────────

async function checkIn(payload) {
  if (!payload.pin) throwHttpError(400, 'PIN is required');
  if (!payload.branchId) throwHttpError(400, 'Branch ID is required');
  assertValidObjectId(payload.branchId, 'branchId');

  // Find employee by PIN + branch (BR-HR30)
  var employee = await findEmployeeByPinAndBranch(payload.pin, payload.branchId);

  // BR-HR31: Check for existing open session
  var todayRange = getTodayRange();
  var openSession = await attendanceRepository.findOpenSession(
    employee.id, todayRange.start, todayRange.end
  );

  if (openSession) {
    throwHttpError(400, 'You are already checked in. Please check out before starting a new session.');
  }

  // BR-HR29: Server-side timestamping
  var now = new Date();

  var timesheet = await attendanceRepository.createTimesheet({
    employeeId: employee.id,
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    checkIn: now,
    note: null
  });

  return {
    timesheet: timesheet,
    employeeName: employee.fullName,
    action: 'CHECK_IN',
    timestamp: now
  };
}

async function checkOut(payload) {
  if (!payload.pin) throwHttpError(400, 'PIN is required');
  if (!payload.branchId) throwHttpError(400, 'Branch ID is required');
  assertValidObjectId(payload.branchId, 'branchId');

  // Find employee by PIN + branch (BR-HR30)
  var employee = await findEmployeeByPinAndBranch(payload.pin, payload.branchId);

  // BR-HR31: Must have an open session to check out
  var todayRange = getTodayRange();
  var openSession = await attendanceRepository.findOpenSession(
    employee.id, todayRange.start, todayRange.end
  );

  if (!openSession) {
    throwHttpError(400, 'No active check-in found. You must check in before checking out.');
  }

  // BR-HR29: Server-side timestamping
  var now = new Date();

  var timesheet = await attendanceRepository.updateTimesheet(openSession.id, {
    checkOut: now
  });

  return {
    timesheet: timesheet,
    employeeName: employee.fullName,
    action: 'CHECK_OUT',
    timestamp: now
  };
}

async function getTodayAttendance(query, currentUser) {
  var branchId = null;

  if (authMiddleware.isChainAdmin(currentUser)) {
    branchId = currentUser.branchId;
  } else if (query.branchId) {
    branchId = query.branchId;
  }

  var todayRange = getTodayRange();
  return await attendanceRepository.findTodayAttendance(branchId, todayRange.start, todayRange.end);
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

async function findEmployeeByPinAndBranch(rawPin, branchId) {
  var employees = await attendanceRepository.findEmployeeByPin(branchId);

  for (var i = 0; i < employees.length; i++) {
    var match = await bcrypt.compare(rawPin, employees[i].pinCode);
    if (match) {
      return employees[i];
    }
  }

  throwHttpError(401, 'Invalid PIN or employee not found at this branch');
}

function getTodayRange() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start, end: end };
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function assertValidObjectId(value, fieldName) {
  if (!value || typeof value !== 'string' || value.length !== 24) {
    throwHttpError(400, 'Invalid ' + fieldName + ': must be a 24-character ObjectId');
  }
}

module.exports = {
  checkIn: checkIn,
  checkOut: checkOut,
  getTodayAttendance: getTodayAttendance
};
