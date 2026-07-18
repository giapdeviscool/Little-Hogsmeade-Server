var branchRepository = require('../repositories/branch.repository');

async function getBranches(query) {
  var page = parsePositiveInt(query.page, 1);
  var limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  var skip = (page - 1) * limit;
  var where = {};

  if (query.status) {
    where.status = normalizeStatus(query.status);
  }

  var items = await branchRepository.findAll({
    where: where,
    skip: skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
  var total = await branchRepository.count(where);

  return {
    items: items,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function createBranch(payload) {
  var data = normalizeBranchPayload(payload, true);

  await assertUniqueGps(data.lat, data.lng);

  return branchRepository.create(data);
}

async function updateBranch(id, payload) {
  assertValidObjectId(id, 'branch id');
  await getBranchOrThrow(id);

  var data = normalizeBranchPayload(payload, false);

  if (data.lat !== undefined && data.lng !== undefined) {
    await assertUniqueGps(data.lat, data.lng, id);
  }

  return branchRepository.update(id, data);
}

async function toggleBranchStatus(id) {
  assertValidObjectId(id, 'branch id');
  var branch = await getBranchOrThrow(id);

  if (branch.status === 'active') {
    var pendingOrders = await branchRepository.hasPendingOrders(id);
    if (pendingOrders > 0) {
      throwHttpError(400, 'Cannot deactivate branch with pending orders');
    }

    var reservedTables = await branchRepository.hasReservedTables(id);
    if (reservedTables > 0) {
      throwHttpError(400, 'Cannot deactivate branch with reserved tables');
    }

    return branchRepository.update(id, { status: 'inactive' });
  }

  return branchRepository.update(id, { status: 'active' });
}

async function getBranchOrThrow(id) {
  var branch = await branchRepository.findById(id);

  if (!branch) {
    throwHttpError(404, 'Branch not found');
  }

  return branch;
}

async function assertUniqueGps(lat, lng, excludeId) {
  var existing = await branchRepository.findActiveByGps(lat, lng, excludeId);

  if (existing) {
    throwHttpError(409, 'GPS coordinates must be unique among active branches');
  }
}

function normalizeBranchPayload(payload, isCreate) {
  var data = {};

  assignRequiredString(data, payload, 'name', isCreate);
  assignRequiredString(data, payload, 'address', isCreate);
  assignRequiredString(data, payload, 'phone', isCreate);
  assignOptionalString(data, payload, 'email');
  assignOptionalString(data, payload, 'imageUrl');
  assignRequiredNumber(data, payload, 'lat', isCreate);
  assignRequiredNumber(data, payload, 'lng', isCreate);
  assignRequiredDate(data, payload, 'openTime', isCreate);
  assignRequiredDate(data, payload, 'closeTime', isCreate);

  if (payload.status !== undefined) {
    data.status = normalizeStatus(payload.status);
  }

  if (payload.allowLocalPricingOverride !== undefined) {
    data.allowLocalPricingOverride = Boolean(payload.allowLocalPricingOverride);
  }

  return data;
}

function assignRequiredString(data, payload, field, isRequired) {
  if (payload[field] === undefined) {
    if (isRequired) {
      throwHttpError(400, field + ' is required');
    }

    return;
  }

  if (typeof payload[field] !== 'string' || payload[field].trim() === '') {
    throwHttpError(400, field + ' must be a non-empty string');
  }

  data[field] = payload[field].trim();
}

function assignOptionalString(data, payload, field) {
  if (payload[field] === undefined) {
    return;
  }

  if (payload[field] === null || payload[field] === '') {
    data[field] = null;
    return;
  }

  if (typeof payload[field] !== 'string') {
    throwHttpError(400, field + ' must be a string');
  }

  data[field] = payload[field].trim();
}

function assignRequiredNumber(data, payload, field, isRequired) {
  if (payload[field] === undefined) {
    if (isRequired) {
      throwHttpError(400, field + ' is required');
    }

    return;
  }

  var value = Number(payload[field]);

  if (!Number.isFinite(value)) {
    throwHttpError(400, field + ' must be a number');
  }

  data[field] = value;
}

function assignRequiredDate(data, payload, field, isRequired) {
  if (payload[field] === undefined) {
    if (isRequired) {
      throwHttpError(400, field + ' is required');
    }

    return;
  }

  var date = parseDate(payload[field], field);
  data[field] = date;
}

function normalizeStatus(status) {
  var normalized = String(status).trim().toLowerCase();

  if (normalized !== 'active' && normalized !== 'inactive') {
    throwHttpError(400, 'status must be active or inactive');
  }

  return normalized;
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  var number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    throwHttpError(400, 'Query value must be a positive integer');
  }

  return number;
}

function parseDate(value, field) {
  var date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throwHttpError(400, field + ' must be a valid date');
  }

  return date;
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
  getBranches: getBranches,
  createBranch: createBranch,
  updateBranch: updateBranch,
  toggleBranchStatus: toggleBranchStatus
};
