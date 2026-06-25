var bcrypt = require('bcryptjs');
var employeeRepository = require('../repositories/employee.repository');
var authMiddleware = require('../middlewares/auth.middleware');
var authService = require('./auth.service');

var SALT_ROUNDS = 10;
var PIN_LENGTH = 6;
var MAX_PAGE_SIZE = 50;
var VALID_STATUSES = ['active', 'on_leave', 'resigned', 'inactive'];
var REVOKED_STATUSES = ['resigned', 'inactive'];
var PRIVILEGED_ROLES = ['owner', 'chain owner', 'chain admin', 'admin', 'manager'];

// ──────────────────────────────────────────────
// UC55 – View the Staff list
// ──────────────────────────────────────────────
async function getEmployees(query, currentUser) {
  var page = parsePositiveInt(query.page, 1);
  var limit = Math.min(parsePositiveInt(query.limit, 20), MAX_PAGE_SIZE);
  var skip = (page - 1) * limit;
  var where = buildWhereFilter(query, currentUser);

  var items = await employeeRepository.findAll({
    where: where,
    skip: skip,
    take: limit,
    orderBy: [
      { status: 'asc' },
      { hiredDate: 'desc' }
    ]
  });

  var total = await employeeRepository.count(where);

  return {
    items: items,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

function buildWhereFilter(query, currentUser) {
  var where = {};

  // BR-HR01: Chain Admin can only see employees from their own branch
  // BR-HR02: Owner has global access
  if (authMiddleware.isOwner(currentUser)) {
    if (query.branchId) {
      assertValidObjectId(query.branchId, 'branchId');
      where.branchId = query.branchId;
    }
  } else if (authMiddleware.isChainAdmin(currentUser)) {
    // Force branch isolation – override any frontend params
    where.branchId = currentUser.branchId;
  }

  // Status filter
  if (query.status) {
    var normalizedStatus = String(query.status).trim().toLowerCase();

    if (VALID_STATUSES.indexOf(normalizedStatus) === -1) {
      throwHttpError(400, 'Invalid status filter. Must be one of: ' + VALID_STATUSES.join(', '));
    }

    where.status = normalizedStatus;
  }

  // Role filter
  if (query.roleId) {
    assertValidObjectId(query.roleId, 'roleId');
    where.roleId = query.roleId;
  }

  // Search by name
  if (query.search) {
    where.fullName = {
      contains: String(query.search).trim(),
      mode: 'insensitive'
    };
  }

  return where;
}

// ──────────────────────────────────────────────
// UC56 – Create employee profile
// ──────────────────────────────────────────────
async function createEmployee(payload, currentUser) {
  var data = validateCreatePayload(payload);

  // BR-HR08: Chain Admin can only create for their own branch
  assertBranchJurisdiction(currentUser, data.branchId);

  // BR-HR07: Phone must be unique
  await assertUniquePhone(data.phone);

  // BR-HR07: Email must be unique (if provided)
  if (data.email) {
    await assertUniqueEmail(data.email);
  }

  // Prevent privilege escalation: Chain Admin cannot create Owner/Admin/Manager etc.
  var targetRole = await employeeRepository.findRoleById(data.roleId);
  if (!targetRole) {
    throwHttpError(400, 'The provided role does not exist');
  }
  assertPrivilegeEscalation(currentUser, targetRole);

  // BR-HR10: Generate secure 6-digit PIN
  var rawPin = generatePinCode();
  var hashedPin = await bcrypt.hash(rawPin, SALT_ROUNDS);

  // BR-HR11: Default status = "active"
  // Set default password '123456' for web dashboard login
  var defaultPasswordHash = authService.hashPassword('123456');

  var employeeData = {
    fullName: data.fullName,
    phone: data.phone,
    email: data.email || null,
    roleId: data.roleId,
    branchId: data.branchId,
    baseSalary: data.baseSalary || null,
    hiredDate: data.hiredDate || new Date(),
    avatarUrl: data.avatarUrl || null,
    pinCode: hashedPin,
    passwordHash: defaultPasswordHash,
    status: 'active'
  };

  var employee = await employeeRepository.create(employeeData);

  return {
    employee: employee,
    generatedPin: rawPin
  };
}

function validateCreatePayload(payload) {
  var data = {};

  // BR-HR09: Required fields
  data.fullName = requireString(payload, 'fullName');
  data.phone = requireString(payload, 'phone');
  data.roleId = requireString(payload, 'roleId');
  data.branchId = requireString(payload, 'branchId');

  assertValidObjectId(data.roleId, 'roleId');
  assertValidObjectId(data.branchId, 'branchId');

  // Validate phone format
  if (!/^[0-9]{9,15}$/.test(data.phone)) {
    throwHttpError(400, 'Phone must be 9-15 digits');
  }

  // Optional fields
  if (payload.email !== undefined && payload.email !== null && payload.email !== '') {
    data.email = String(payload.email).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throwHttpError(400, 'Invalid email format');
    }
  }

  if (payload.baseSalary !== undefined && payload.baseSalary !== null) {
    data.baseSalary = Number(payload.baseSalary);

    if (!Number.isFinite(data.baseSalary) || data.baseSalary < 0) {
      throwHttpError(400, 'baseSalary must be a non-negative number');
    }
  }

  if (payload.hiredDate !== undefined && payload.hiredDate !== null) {
    var date = new Date(payload.hiredDate);

    if (Number.isNaN(date.getTime())) {
      throwHttpError(400, 'hiredDate must be a valid date');
    }

    data.hiredDate = date;
  }

  if (payload.avatarUrl !== undefined) {
    data.avatarUrl = payload.avatarUrl || null;
  }

  return data;
}

// ──────────────────────────────────────────────
// UC57 – Update employee status
// ──────────────────────────────────────────────
async function updateEmployee(id, payload, currentUser) {
  assertValidObjectId(id, 'employee id');

  var existing = await employeeRepository.findById(id);

  if (!existing) {
    throwHttpError(404, 'Employee not found');
  }

  // BR-HR12: Chain Admin can only update employees in their branch
  assertBranchJurisdiction(currentUser, existing.branchId);

  var updateData = validateUpdatePayload(payload, existing);

  // BR-HR15: Re-validate uniqueness if phone/email changed
  if (updateData.phone && updateData.phone !== existing.phone) {
    await assertUniquePhone(updateData.phone, id);
  }

  if (updateData.email && updateData.email !== existing.email) {
    await assertUniqueEmail(updateData.email, id);
  }

  // BR-HR16: Check active shift/attendance before status change to resigned
  if (updateData.status && REVOKED_STATUSES.indexOf(updateData.status) !== -1) {
    var openShifts = await employeeRepository.hasOpenShift(id);

    if (openShifts > 0) {
      throwHttpError(400, 'Cannot change status: employee has an OPEN shift. Please close the shift first.');
    }

    var activeAttendance = await employeeRepository.hasActiveAttendance(id);

    if (activeAttendance > 0) {
      throwHttpError(400, 'Cannot change status: employee has active attendance. Please check-out first.');
    }

    // BR-HR13: Revoke POS access
    updateData.pinCode = null;
    updateData.passwordHash = null;
  }

  var employee = await employeeRepository.update(id, updateData);

  return employee;
}

function validateUpdatePayload(payload, existing) {
  var data = {};
  var hasUpdate = false;

  if (payload.fullName !== undefined) {
    data.fullName = requireNonEmptyString(payload.fullName, 'fullName');
    hasUpdate = true;
  }

  if (payload.phone !== undefined) {
    data.phone = requireNonEmptyString(payload.phone, 'phone');

    if (!/^[0-9]{9,15}$/.test(data.phone)) {
      throwHttpError(400, 'Phone must be 9-15 digits');
    }

    hasUpdate = true;
  }

  if (payload.email !== undefined) {
    if (payload.email === null || payload.email === '') {
      data.email = null;
    } else {
      data.email = String(payload.email).trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        throwHttpError(400, 'Invalid email format');
      }
    }

    hasUpdate = true;
  }

  if (payload.baseSalary !== undefined) {
    if (payload.baseSalary === null) {
      data.baseSalary = null;
    } else {
      data.baseSalary = Number(payload.baseSalary);

      if (!Number.isFinite(data.baseSalary) || data.baseSalary < 0) {
        throwHttpError(400, 'baseSalary must be a non-negative number');
      }
    }

    hasUpdate = true;
  }

  if (payload.status !== undefined) {
    var normalizedStatus = String(payload.status).trim().toLowerCase();

    if (VALID_STATUSES.indexOf(normalizedStatus) === -1) {
      throwHttpError(400, 'Invalid status. Must be one of: ' + VALID_STATUSES.join(', '));
    }

    data.status = normalizedStatus;
    hasUpdate = true;
  }

  if (payload.avatarUrl !== undefined) {
    data.avatarUrl = payload.avatarUrl || null;
    hasUpdate = true;
  }

  if (payload.hiredDate !== undefined) {
    var date = new Date(payload.hiredDate);

    if (Number.isNaN(date.getTime())) {
      throwHttpError(400, 'hiredDate must be a valid date');
    }

    data.hiredDate = date;
    hasUpdate = true;
  }

  if (!hasUpdate) {
    throwHttpError(400, 'No fields to update');
  }

  return data;
}

// ──────────────────────────────────────────────
// UC58 – Assign account roles
// ──────────────────────────────────────────────
async function assignRole(employeeId, roleId, currentUser) {
  assertValidObjectId(employeeId, 'employee id');

  if (!roleId) {
    throwHttpError(400, 'roleId is required');
  }

  assertValidObjectId(roleId, 'roleId');

  // BR-HR20: Cannot modify own role to prevent accidental lockouts
  if (currentUser.id === employeeId) {
    throwHttpError(400, 'You cannot modify your own access level to prevent accidental system lockouts.');
  }

  var existing = await employeeRepository.findById(employeeId);

  if (!existing) {
    throwHttpError(404, 'Employee not found');
  }

  // BR-HR20: Branch jurisdiction
  assertBranchJurisdiction(currentUser, existing.branchId);

  // Validate target role exists
  var targetRole = await employeeRepository.findRoleById(roleId);

  if (!targetRole) {
    throwHttpError(400, 'The provided role does not exist in the system');
  }

  // BR-HR17: Privilege escalation prevention
  assertPrivilegeEscalation(currentUser, targetRole);

  // BR-HR19: Cannot revoke Cashier role if employee has open shift
  var currentRoleName = existing.role ? String(existing.role.name).toLowerCase() : '';
  var newRoleName = String(targetRole.name).toLowerCase();

  if (currentRoleName.indexOf('cashier') > -1 && newRoleName.indexOf('cashier') === -1) {
    var openShifts = await employeeRepository.hasOpenShift(employeeId);

    if (openShifts > 0) {
      throwHttpError(400, 'Cannot revoke Cashier privileges while the employee has an OPEN shift. Please close the shift first.');
    }
  }

  // If role didn't actually change, no-op
  if (existing.roleId === roleId) {
    throwHttpError(400, 'Employee already has this role assigned');
  }

  var employee = await employeeRepository.update(employeeId, { roleId: roleId });

  return employee;
}

function assertPrivilegeEscalation(currentUser, targetRole) {
  var targetRoleName = String(targetRole.name || '').trim().toLowerCase();
  var isTargetPrivileged = false;

  for (var i = 0; i < PRIVILEGED_ROLES.length; i++) {
    if (targetRoleName.indexOf(PRIVILEGED_ROLES[i]) > -1) {
      isTargetPrivileged = true;
      break;
    }
  }

  // Chain Admin cannot assign Owner or Chain Admin roles
  if (isTargetPrivileged && !authMiddleware.isOwner(currentUser)) {
    throwHttpError(403, 'Permission Denied: Only an Owner can assign administrative roles. Privilege escalation is strictly prohibited.');
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function assertBranchJurisdiction(currentUser, targetBranchId) {
  if (authMiddleware.isOwner(currentUser)) {
    return; // Owner bypasses branch restrictions
  }

  if (currentUser.branchId !== targetBranchId) {
    throwHttpError(403, 'You do not have permission to manage employees in this branch');
  }
}

async function assertUniquePhone(phone, excludeId) {
  var existing = await employeeRepository.findByPhone(phone, excludeId);

  if (existing) {
    throwHttpError(409, 'An employee with this phone number already exists');
  }
}

async function assertUniqueEmail(email, excludeId) {
  var existing = await employeeRepository.findByEmail(email, excludeId);

  if (existing) {
    throwHttpError(409, 'An employee with this email already exists');
  }
}

function generatePinCode() {
  var pin = '';

  for (var i = 0; i < PIN_LENGTH; i++) {
    pin += String(Math.floor(Math.random() * 10));
  }

  return pin;
}

function requireString(payload, field) {
  if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
    throwHttpError(400, field + ' is required');
  }

  return String(payload[field]).trim();
}

function requireNonEmptyString(value, field) {
  if (value === undefined || value === null || value === '') {
    throwHttpError(400, field + ' must be a non-empty string');
  }

  return String(value).trim();
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  var number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }

  return number;
}

function assertValidObjectId(value, fieldName) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throwHttpError(400, fieldName + ' must be a valid ObjectId');
  }
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  getEmployees: getEmployees,
  createEmployee: createEmployee,
  updateEmployee: updateEmployee,
  assignRole: assignRole
};
