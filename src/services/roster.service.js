var rosterRepository = require('../repositories/roster.repository');
var shiftRepository = require('../repositories/shift.repository');
var employeeRepository = require('../repositories/employee.repository');
var authMiddleware = require('../middlewares/auth.middleware');

// ──────────────────────────────────────────────
// UC60 – Assign work schedules
// ──────────────────────────────────────────────

async function getRosters(query, currentUser) {
  var options = {};

  // BR-HR25: Chain Admin → only their branch
  if (authMiddleware.isChainAdmin(currentUser)) {
    options.branchId = currentUser.branchId;
  } else if (query.branchId) {
    assertValidObjectId(query.branchId, 'branchId');
    options.branchId = query.branchId;
  }

  // BR-HR28: Staff/Cashier see only their own schedule
  if (!authMiddleware.isOwner(currentUser) && !authMiddleware.isChainAdmin(currentUser)) {
    options.employeeId = currentUser.id;
  } else if (query.employeeId) {
    options.employeeId = query.employeeId;
  }

  // Week range
  if (query.weekStart) {
    var weekStart = new Date(query.weekStart);
    weekStart.setHours(0, 0, 0, 0);
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    options.dateFrom = weekStart;
    options.dateTo = weekEnd;
  } else if (query.dateFrom && query.dateTo) {
    options.dateFrom = query.dateFrom;
    options.dateTo = query.dateTo;
  }

  return await rosterRepository.findAll(options);
}

async function createRoster(payload, currentUser) {
  if (!payload.employeeId) throwHttpError(400, 'Employee ID is required');
  if (!payload.shiftId) throwHttpError(400, 'Shift ID is required');
  if (!payload.date) throwHttpError(400, 'Date is required');

  assertValidObjectId(payload.employeeId, 'employeeId');
  assertValidObjectId(payload.shiftId, 'shiftId');

  // Validate employee exists and is active (BR-HR27)
  var employee = await employeeRepository.findById(payload.employeeId);
  if (!employee) {
    throwHttpError(404, 'Employee not found');
  }
  if (employee.status !== 'active') {
    throwHttpError(400, 'Only active employees can be assigned to schedules (BR-HR27)');
  }

  // BR-HR25: Branch jurisdiction
  var targetBranchId = payload.branchId || employee.branchId;
  assertBranchJurisdiction(currentUser, targetBranchId);

  // Validate shift exists and is active
  var shift = await shiftRepository.findById(payload.shiftId);
  if (!shift) {
    throwHttpError(404, 'Shift not found');
  }
  if (shift.status !== 'active') {
    throwHttpError(400, 'Cannot assign an inactive shift');
  }

  // Normalize date to midnight UTC
  var rosterDate = new Date(payload.date);
  rosterDate.setUTCHours(0, 0, 0, 0);

  // BR-HR26: Check for exact same shift on same day (unique constraint)
  var existingDuplicate = await rosterRepository.findOverlap(
    payload.employeeId,
    rosterDate,
    payload.shiftId
  );
  if (existingDuplicate) {
    throwHttpError(409, 'This employee is already assigned to this shift on this date');
  }

  // BR-HR26: Check time overlap with other shifts on the same day
  var existingRosters = await rosterRepository.findExistingRosters(payload.employeeId, rosterDate);
  for (var i = 0; i < existingRosters.length; i++) {
    var existingShift = existingRosters[i].shift;
    if (existingShift && hasTimeOverlap(shift, existingShift)) {
      throwHttpError(409,
        'Scheduling Conflict: This employee is already assigned to "' +
        existingShift.name + '" which overlaps with "' + shift.name + '"'
      );
    }
  }

  var data = {
    branchId: targetBranchId,
    employeeId: payload.employeeId,
    shiftId: payload.shiftId,
    date: rosterDate,
    status: 'scheduled'
  };

  return await rosterRepository.create(data);
}

async function createBulkRosters(entries, currentUser) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throwHttpError(400, 'At least one schedule entry is required');
  }

  var results = [];
  var errors = [];

  for (var i = 0; i < entries.length; i++) {
    try {
      var roster = await createRoster(entries[i], currentUser);
      results.push(roster);
    } catch (err) {
      errors.push({
        index: i,
        entry: entries[i],
        error: err.message
      });
    }
  }

  return { created: results, errors: errors };
}

async function deleteRoster(id, currentUser) {
  assertValidObjectId(id, 'roster id');

  var existing = await rosterRepository.findById(id);
  if (!existing) {
    throwHttpError(404, 'Schedule entry not found');
  }

  assertBranchJurisdiction(currentUser, existing.branchId);

  await rosterRepository.remove(id);
  return { message: 'Schedule entry removed successfully' };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function hasTimeOverlap(shiftA, shiftB) {
  var aStart = normalizeMinutes(shiftA.startTime);
  var aEnd = normalizeMinutes(shiftA.endTime);
  var bStart = normalizeMinutes(shiftB.startTime);
  var bEnd = normalizeMinutes(shiftB.endTime);

  // Handle overnight shifts (end < start means crosses midnight)
  if (aEnd <= aStart) aEnd += 1440; // +24h in minutes
  if (bEnd <= bStart) bEnd += 1440;

  // Standard overlap check
  return aStart < bEnd && bStart < aEnd;
}

function normalizeMinutes(time) {
  var d = new Date(time);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function assertBranchJurisdiction(currentUser, targetBranchId) {
  if (authMiddleware.isChainAdmin(currentUser) && currentUser.branchId !== targetBranchId) {
    throwHttpError(403, 'Permission Denied: You can only manage schedules for your own branch');
  }
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
  getRosters: getRosters,
  createRoster: createRoster,
  createBulkRosters: createBulkRosters,
  deleteRoster: deleteRoster
};
