var bcrypt = require('bcryptjs');
var attendanceRepository = require('../repositories/attendance.repository');
var branchRepository = require('../repositories/branch.repository');
var rosterRepository = require('../repositories/roster.repository');
var authMiddleware = require('../middlewares/auth.middleware');

// ──────────────────────────────────────────────
// UC61 – Record attendance
// ──────────────────────────────────────────────

async function checkIn(payload) {
  if (!payload.pin) throwHttpError(400, 'PIN is required');
  if (payload.lat === undefined || payload.lng === undefined) {
    throwHttpError(400, 'Không thể xác định vị trí của bạn. Vui lòng cấp quyền truy cập Vị trí trên trình duyệt.');
  }

  // Find employee globally by PIN
  var employee = await findEmployeeByPinGlobal(payload.pin);

  var branch = await branchRepository.findById(employee.branchId);
  if (!branch) throwHttpError(400, 'Chi nhánh không tồn tại');

  var distance = getDistanceFromLatLonInM(payload.lat, payload.lng, branch.lat, branch.lng);
  if (distance > 200) {
    throwHttpError(400, 'Bạn đang không ở quán (khoảng cách ' + Math.round(distance) + 'm). Không thể chấm công.');
  }

  // BR-HR31: Check for existing open session
  var todayRange = getTodayRange();
  var openSession = await attendanceRepository.findOpenSession(
    employee.id, todayRange.start, todayRange.end
  );

  if (openSession) {
    throwHttpError(400, 'You are already checked in. Please check out before starting a new session.');
  }

  // Roster-based constraint (+/- 15 mins)
  var now = new Date();
  var todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  var rosters = await rosterRepository.findExistingRosters(employee.id, todayUTC);
  
  if (!rosters || rosters.length === 0) {
    throwHttpError(400, 'Bạn không có ca làm việc được xếp trong hôm nay. Không thể chấm công.');
  }

  var currentMinutes = now.getHours() * 60 + now.getMinutes();
  var matchedShift = null;

  for (var i = 0; i < rosters.length; i++) {
    var shift = rosters[i].shift;
    if (!shift) continue;
    var shiftMinutes = shift.startTime.getUTCHours() * 60 + shift.startTime.getUTCMinutes();
    
    var diff = currentMinutes - shiftMinutes;
    if (diff < -720) diff += 1440;
    if (diff > 720) diff -= 1440;

    if (diff >= -15 && diff <= 15) {
      matchedShift = shift;
      break;
    }
  }

  if (!matchedShift) {
    throwHttpError(400, 'Bạn chỉ được phép chấm công trong khoảng thời gian +/- 15 phút so với giờ vào ca của lịch làm việc hôm nay.');
  }

  // Prevent multiple check-ins for the same shift
  var existingTimesheet = await attendanceRepository.findTimesheetByShift(
    employee.id, matchedShift.id, todayRange.start, todayRange.end
  );
  if (existingTimesheet) {
    throwHttpError(400, 'Bạn đã chấm công cho ca làm việc này rồi.');
  }

  // BR-HR29: Server-side timestamping
  var timesheet = await attendanceRepository.createTimesheet({
    employeeId: employee.id,
    shiftId: matchedShift.id,
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
  if (payload.lat === undefined || payload.lng === undefined) {
    throwHttpError(400, 'Không thể xác định vị trí của bạn. Vui lòng cấp quyền truy cập Vị trí trên trình duyệt.');
  }

  // Find employee globally by PIN
  var employee = await findEmployeeByPinGlobal(payload.pin);

  var branch = await branchRepository.findById(employee.branchId);
  if (!branch) throwHttpError(400, 'Chi nhánh không tồn tại');

  var distance = getDistanceFromLatLonInM(payload.lat, payload.lng, branch.lat, branch.lng);
  if (distance > 200) {
    throwHttpError(400, 'Bạn đang không ở quán (khoảng cách ' + Math.round(distance) + 'm). Không thể chấm công.');
  }

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

async function findEmployeeByPinGlobal(rawPin) {
  var employees = await attendanceRepository.findEmployeeByPin();
  var matchedEmployees = [];

  for (var i = 0; i < employees.length; i++) {
    var match = await bcrypt.compare(rawPin, employees[i].pinCode);
    if (match) {
      matchedEmployees.push(employees[i]);
    }
  }

  if (matchedEmployees.length === 0) {
    throwHttpError(401, 'Mã PIN không đúng.');
  }
  if (matchedEmployees.length > 1) {
    throwHttpError(400, 'Mã PIN đang trùng lặp giữa nhiều nhân viên. Vui lòng báo cho quản lý để đổi mã PIN.');
  }

  return matchedEmployees[0];
}

function getTodayRange() {
  var now = new Date();
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  var end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start, end: end };
}

function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d * 1000;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
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
