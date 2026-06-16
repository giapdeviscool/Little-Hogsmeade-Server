var shiftRepository = require('../repositories/shift.repository');
var authMiddleware = require('../middlewares/auth.middleware');

// ──────────────────────────────────────────────
// UC59 – Manage shift categories
// ──────────────────────────────────────────────

async function getShifts(query, currentUser) {
  var options = {};

  if (query.branchId) {
    assertValidObjectId(query.branchId, 'branchId');
    if (authMiddleware.isChainAdmin(currentUser) && currentUser.branchId !== query.branchId) {
      throwHttpError(403, 'You do not have permission to view shifts for this branch');
    }
    options.branchId = query.branchId;
  } else if (authMiddleware.isChainAdmin(currentUser)) {
    options.branchId = currentUser.branchId;
  }

  return await shiftRepository.findAll(options);
}

async function createShift(payload, currentUser) {
  validateShiftPayload(payload);
  assertBranchJurisdiction(currentUser, payload.branchId);

  // BR-HR24: No duplicate names within same branch
  var duplicate = await shiftRepository.findByNameAndBranch(payload.name, payload.branchId);
  if (duplicate) {
    throwHttpError(409, 'A shift with this name already exists in this branch');
  }

  var data = {
    name: payload.name.trim(),
    branchId: payload.branchId,
    startTime: standardizeTime(payload.startTime),
    endTime: standardizeTime(payload.endTime),
    status: 'active'
  };

  return await shiftRepository.create(data);
}

async function updateShift(id, payload, currentUser) {
  assertValidObjectId(id, 'shift id');

  var existing = await shiftRepository.findById(id);
  if (!existing) {
    throwHttpError(404, 'Shift not found');
  }

  assertBranchJurisdiction(currentUser, existing.branchId);

  if (payload.branchId && payload.branchId !== existing.branchId) {
    throwHttpError(400, 'Cannot change the branch of an existing shift');
  }

  if (payload.name) {
    var duplicate = await shiftRepository.findByNameAndBranch(payload.name, existing.branchId, id);
    if (duplicate) {
      throwHttpError(409, 'A shift with this name already exists in this branch');
    }
  }

  var updateData = {};
  if (payload.name) updateData.name = payload.name.trim();
  if (payload.startTime) updateData.startTime = standardizeTime(payload.startTime);
  if (payload.endTime) updateData.endTime = standardizeTime(payload.endTime);

  return await shiftRepository.update(id, updateData);
}

async function deleteShift(id, currentUser) {
  assertValidObjectId(id, 'shift id');

  var existing = await shiftRepository.findById(id);
  if (!existing) {
    throwHttpError(404, 'Shift not found');
  }

  assertBranchJurisdiction(currentUser, existing.branchId);

  // BR-HR23: Soft delete if linked
  var linkedTimesheets = await shiftRepository.hasLinkedTimesheets(id);
  var linkedRosters = await shiftRepository.hasLinkedRosters(id);

  var updated = await shiftRepository.update(id, { status: 'inactive' });

  if (linkedTimesheets > 0 || linkedRosters > 0) {
    return { shift: updated, message: 'Shift marked as inactive (referenced in past records)' };
  }

  return { shift: updated, message: 'Shift deleted successfully' };
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function validateShiftPayload(payload) {
  if (!payload.name || !payload.name.trim()) throwHttpError(400, 'Shift name is required');
  if (!payload.branchId) throwHttpError(400, 'Branch ID is required');
  if (!payload.startTime) throwHttpError(400, 'Start time is required');
  if (!payload.endTime) throwHttpError(400, 'End time is required');
  assertValidObjectId(payload.branchId, 'branchId');
}

function assertBranchJurisdiction(currentUser, targetBranchId) {
  if (authMiddleware.isChainAdmin(currentUser) && currentUser.branchId !== targetBranchId) {
    throwHttpError(403, 'Permission Denied: You can only manage shifts for your own branch');
  }
}

function standardizeTime(timeInput) {
  var date = new Date('1970-01-01T00:00:00.000Z');

  if (typeof timeInput === 'string') {
    if (timeInput.indexOf(':') !== -1) {
      var parts = timeInput.split(':');
      date.setUTCHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      return date;
    }
  }

  var parsed = new Date(timeInput);
  if (!isNaN(parsed.getTime())) {
    date.setUTCHours(parsed.getUTCHours(), parsed.getUTCMinutes(), 0, 0);
    return date;
  }

  throwHttpError(400, 'Invalid time format');
}

// BR-HR21: Overnight shift duration calculation
function calculateDurationHours(startTime, endTime) {
  var start = standardizeTime(startTime);
  var end = standardizeTime(endTime);
  var durationMs = end.getTime() - start.getTime();

  if (durationMs < 0) {
    durationMs += 24 * 60 * 60 * 1000;
  }

  return durationMs / (1000 * 60 * 60);
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
  getShifts: getShifts,
  createShift: createShift,
  updateShift: updateShift,
  deleteShift: deleteShift,
  calculateDurationHours: calculateDurationHours
};
