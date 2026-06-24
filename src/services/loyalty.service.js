var loyaltyRepository = require('../repositories/loyalty.repository');

var DEFAULT_SPEND_AMOUNT = 10000;
var DEFAULT_EARN_POINT = 1;
var DEFAULT_POINTS_EXPIRY_DAYS = 365;
var MIN_SPEND_AMOUNT = 1000;
var MIN_EARN_POINT = 1;

async function getConfig(user, query) {
  var branchId = resolveBranchId(user, query && query.branchId);

  var config = await loyaltyRepository.findActiveConfigByBranch(branchId);

  if (!config) {
    config = await loyaltyRepository.createConfig(buildDefaultConfig(branchId));
  }

  return formatConfigResponse(config);
}

async function updateConfig(payload, user, query) {
  var branchId = resolveBranchId(user, (payload && payload.branchId) || (query && query.branchId));
  var config = await loyaltyRepository.findActiveConfigByBranch(branchId);
  var data = {};

  if (payload.spend_amount !== undefined) {
    data.spendAmount = parseSpendAmount(payload.spend_amount);
  }

  if (payload.earn_point !== undefined) {
    data.earnPoint = parseEarnPoint(payload.earn_point);
  }

  if (payload.is_active !== undefined) {
    data.isActive = Boolean(payload.is_active);
  }

  if (payload.points_expiry_days !== undefined) {
    data.pointsExpiryDays = parsePointsExpiryDays(payload.points_expiry_days);
  }

  if (payload.allow_voucher_earning !== undefined) {
    data.allowVoucherEarning = Boolean(payload.allow_voucher_earning);
  }

  if (payload.allow_fractional_points !== undefined) {
    data.allowFractionalPoints = Boolean(payload.allow_fractional_points);
  }

  if (!config) {
    var defaults = buildDefaultConfig(branchId);
    config = await loyaltyRepository.createConfig(Object.assign(defaults, data));
    return formatConfigResponse(config);
  }

  var spendAmount = data.spendAmount !== undefined ? data.spendAmount : config.spendAmount;
  var earnPoint = data.earnPoint !== undefined ? data.earnPoint : config.earnPoint;

  data.spendPerPoint = computeSpendPerPoint(spendAmount, earnPoint);
  data.pointToVnd = data.spendPerPoint;

  config = await loyaltyRepository.updateConfig(config.id, data);
  return formatConfigResponse(config);
}

function buildDefaultConfig(branchId) {
  var spendPerPoint = computeSpendPerPoint(DEFAULT_SPEND_AMOUNT, DEFAULT_EARN_POINT);

  return {
    branchId: branchId,
    spendAmount: DEFAULT_SPEND_AMOUNT,
    earnPoint: DEFAULT_EARN_POINT,
    spendPerPoint: spendPerPoint,
    pointToVnd: spendPerPoint,
    pointsExpiryDays: DEFAULT_POINTS_EXPIRY_DAYS,
    allowVoucherEarning: false,
    allowFractionalPoints: false,
    isActive: true
  };
}

function computeSpendPerPoint(spendAmount, earnPoint) {
  return spendAmount / earnPoint;
}

function formatConfigResponse(config) {
  return {
    id: config.id,
    branch_id: config.branchId,
    spend_amount: config.spendAmount,
    earn_point: config.earnPoint,
    spend_per_point: config.spendPerPoint,
    point_to_vnd: config.pointToVnd,
    points_expiry_days: config.pointsExpiryDays,
    allow_voucher_earning: config.allowVoucherEarning,
    allow_fractional_points: config.allowFractionalPoints,
    is_active: config.isActive
  };
}

function resolveBranchId(user, branchId) {
  var resolvedBranchId = branchId || (user && user.branchId) || null;

  if (!resolvedBranchId) {
    throwHttpError(400, 'branchId is required');
  }

  assertValidObjectId(resolvedBranchId, 'branchId');
  return resolvedBranchId;
}

function parseSpendAmount(value) {
  var amount = Number(value);

  if (!Number.isFinite(amount) || amount < MIN_SPEND_AMOUNT) {
    throwHttpError(400, 'spend_amount must be greater than or equal to ' + MIN_SPEND_AMOUNT);
  }

  return amount;
}

function parseEarnPoint(value) {
  var points = parseInt(value, 10);

  if (!Number.isFinite(points) || points < MIN_EARN_POINT) {
    throwHttpError(400, 'earn_point must be greater than or equal to ' + MIN_EARN_POINT);
  }

  return points;
}

function parsePointsExpiryDays(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  var days = parseInt(value, 10);

  if (Number.isNaN(days)) {
    throwHttpError(400, 'points_expiry_days must be a positive integer or 0 for unlimited');
  }

  if (days === 0) {
    return null;
  }

  if (days < 1) {
    throwHttpError(400, 'points_expiry_days must be a positive integer or 0 for unlimited');
  }

  return days;
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
  getConfig: getConfig,
  updateConfig: updateConfig,
  computeSpendPerPoint: computeSpendPerPoint
};
