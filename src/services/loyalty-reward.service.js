var loyaltyRewardRepository = require('../repositories/loyalty-reward.repository');
var menuItemRepository = require('../repositories/menu-item.repository');

var REWARD_TYPES = ['VOUCHER', 'FREE_PRODUCT'];
var REWARD_STATUSES = ['active', 'inactive'];
var DEFAULT_PAGE = 1;
var DEFAULT_LIMIT = 10;
var MAX_LIMIT = 100;
var MIN_REQUIRED_POINTS = 1;

async function getRewards(user, query) {
  var branchId = null;
  try {
    if (query && query.branchId === 'null') {
      branchId = null;
    } else {
      branchId = resolveBranchId(user, query && query.branchId);
    }
  } catch (err) {
    // allow branchId to be optional for general viewing
    branchId = undefined;
  }
  
  var page = parsePositiveInt(query && query.page, DEFAULT_PAGE);
  var limit = Math.min(parsePositiveInt(query && query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  var skip = (page - 1) * limit;
  var filters = {
    isDeleted: false
  };

  if (branchId !== undefined) {
    filters.branchId = branchId;
  }

  if (query && query.search) {
    filters.name = {
      contains: String(query.search).trim(),
      mode: 'insensitive'
    };
  }

  if (query && query.discount_type) {
    filters.discountType = query.discount_type;
  }

  if (query && query.status) {
    filters.status = parseStatus(query.status);
  }

  var results = await Promise.all([
    loyaltyRewardRepository.findRewards(filters, skip, limit),
    loyaltyRewardRepository.countRewards(filters)
  ]);
  var items = results[0];
  var total = results[1];

  return {
    items: items.map(formatRewardResponse),
    pagination: {
      total_items: total,
      current_page: page,
      total_pages: Math.ceil(total / limit) || 1
    }
  };
}

async function createReward(payload, user, query) {
  var rawBranchId = undefined;
  if (payload && payload.branchId !== undefined) {
    rawBranchId = payload.branchId;
  } else if (query && query.branchId !== undefined) {
    rawBranchId = query.branchId;
  }
  var branchId = null;
  try {
    if (rawBranchId === null || rawBranchId === 'null') {
      branchId = null;
    } else {
      branchId = resolveBranchId(user, rawBranchId);
    }
  } catch(e) {
    // If not found, it's a global reward, which is allowed now
  }
  var data = buildRewardData(payload, branchId);

  await validateProductForReward(data.discountType, data.productId, branchId);

  var reward = await loyaltyRewardRepository.createReward(data);

  return {
    reward_id: reward.id
  };
}

async function updateReward(id, payload, user) {
  assertValidObjectId(id, 'id');

  var reward = await loyaltyRewardRepository.findRewardById(id);

  if (!reward) {
    throwHttpError(404, 'Reward not found');
  }

  assertBranchAccess(user, reward.branchId);

  var data = buildRewardUpdateData(payload, reward);
  
  if (data.productId !== undefined || data.discountType !== undefined) {
    var discountType = data.discountType !== undefined ? data.discountType : reward.discountType;
    var productId = data.productId !== undefined ? data.productId : reward.productId;
    await validateProductForReward(discountType, productId, reward.branchId);
  }
  const updatedReward = await loyaltyRewardRepository.updateReward(id, data);
  return updatedReward;
}

async function deleteReward(id, user) {
  assertValidObjectId(id, 'id');

  var reward = await loyaltyRewardRepository.findRewardById(id);

  if (!reward) {
    throwHttpError(404, 'Reward not found');
  }

  assertBranchAccess(user, reward.branchId);

  await loyaltyRewardRepository.updateReward(id, {
    isActive: false,
    isDeleted: true,
    updatedAt: new Date()
  });
}

function buildRewardData(payload, branchId) {
  if (!payload || !payload.name || !String(payload.name).trim()) {
    throwHttpError(400, 'name is required');
  }

  var requiredPoints = parseRequiredPoints(payload.pointsRequired);
  var discountValue = normalizeNumber(payload.discountValue);
  var discountType = payload.discountType;
  if (discountType !== 'fixed' && discountType !== 'gift') {
    discountType = 'percent';
  }
  var minOrderValue = normalizeNumber(payload.minOrderValue);
  var expiryDays = parsePositiveInt(payload.expiryDays, 30);
  var productId = payload.productId || null;

  validateRewardTypeFields(discountType, discountValue, minOrderValue, productId);

  return {
    branchId: branchId,
    name: String(payload.name).trim(),
    pointsRequired: requiredPoints,
    discountValue: discountValue,
    discountType: discountType,
    minOrderValue: minOrderValue,
    expiryDays: expiryDays,
    productId: productId,
    description: payload.description ? String(payload.description).trim() : null,
    imageUrl: payload.imageUrl ? String(payload.imageUrl).trim() : null,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true
  };
}

function buildRewardUpdateData(payload, reward) {
  if (!payload || typeof payload !== 'object') {
    throwHttpError(400, 'Request body is required');
  }

  var data = {
    updatedAt: new Date()
  };

  if (payload.branchId !== undefined) {
    if (payload.branchId === null || payload.branchId === 'null') {
      data.branchId = null;
    } else {
      data.branchId = payload.branchId;
    }
  }

  if (payload.name !== undefined) {
    if (!String(payload.name).trim()) {
      throwHttpError(400, 'name must be a non-empty string');
    }
    data.name = String(payload.name).trim();
  }

  if (payload.pointsRequired !== undefined) {
    data.pointsRequired = parseRequiredPoints(payload.pointsRequired);
  }

  if (payload.discountType !== undefined) {
    var dt = payload.discountType;
    data.discountType = (dt === 'fixed' || dt === 'gift') ? dt : 'percent';
  }

  if (payload.discountValue !== undefined) {
    data.discountValue = normalizeNumber(payload.discountValue);
  }

  if (payload.minOrderValue !== undefined) {
    data.minOrderValue = normalizeNumber(payload.minOrderValue);
  }

  if (payload.expiryDays !== undefined) {
    data.expiryDays = parsePositiveInt(payload.expiryDays, 30);
  }

  if (payload.productId !== undefined) {
    data.productId = payload.productId || null;
  }

  if (payload.description !== undefined) {
    data.description = payload.description ? String(payload.description).trim() : null;
  }

  if (payload.imageUrl !== undefined) {
    data.imageUrl = payload.imageUrl ? String(payload.imageUrl).trim() : null;
  }

  if (payload.isActive !== undefined) {
    data.isActive = Boolean(payload.isActive);
  }

  var discountType = data.discountType !== undefined ? data.discountType : reward.discountType;
  var discountValue = data.discountValue !== undefined ? data.discountValue : reward.discountValue;
  var minOrderValue = data.minOrderValue !== undefined ? data.minOrderValue : reward.minOrderValue;
  var productId = data.productId !== undefined ? data.productId : reward.productId;

  validateRewardTypeFields(discountType, discountValue, minOrderValue, productId);

  return data;
}

function validateRewardTypeFields(discountType, discountValue, minOrderValue, productId) {
  // If it's a product reward (productId exists), it can also have discounts or just be a free product.
  // We'll just validate basic number constraints.
  if (discountValue < 0) {
    throwHttpError(400, 'discountValue must be greater than or equal to 0');
  }

  if (minOrderValue < 0) {
    throwHttpError(400, 'minOrderValue must be greater than or equal to 0');
  }

  if (productId) {
    assertValidObjectId(productId, 'productId');
  }
}

async function validateProductForReward(discountType, productId, branchId) {
  if (!productId) {
    return;
  }

  var product = await menuItemRepository.findMenuItemById(productId);

  if (!product || !product.isActive) {
    throwHttpError(400, 'productId must reference an active menu item');
  }

  if (product.branchId && product.branchId !== branchId) {
    throwHttpError(400, 'productId must belong to the same branch');
  }
}

function formatRewardResponse(reward) {
  var item = {
    id: reward.id,
    name: reward.name,
    pointsRequired: reward.pointsRequired,
    discountValue: reward.discountValue,
    discountType: reward.discountType,
    minOrderValue: reward.minOrderValue,
    expiryDays: reward.expiryDays,
    productId: reward.productId,
    isActive: reward.isActive,
    isDeleted: reward.isDeleted,
    description: reward.description || null,
    imageUrl: reward.imageUrl || null
  };

  if (reward.product && reward.product.name) {
    item.product_name = reward.product.name;
  }

  return item;
}

function parseRewardType(value) {
  var rewardType = String(value || '').trim().toUpperCase();

  if (REWARD_TYPES.indexOf(rewardType) === -1) {
    throwHttpError(400, 'reward_type must be VOUCHER or FREE_PRODUCT');
  }

  return rewardType;
}

function parseStatus(value) {
  var status = String(value || '').trim().toLowerCase();

  if (REWARD_STATUSES.indexOf(status) === -1) {
    throwHttpError(400, 'status must be active or inactive');
  }

  return status;
}

function parseRequiredPoints(value) {
  var points = parseInt(value, 10);

  if (!Number.isFinite(points) || points < MIN_REQUIRED_POINTS) {
    throwHttpError(400, 'pointsRequired must be greater than or equal to ' + MIN_REQUIRED_POINTS);
  }

  return points;
}

function parsePositiveInt(value, fallback) {
  var parsed = parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function normalizeNumber(value) {
  var number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function resolveBranchId(user, branchId) {
  var resolvedBranchId = branchId || (user && user.branchId) || null;

  if (!resolvedBranchId) {
    throwHttpError(400, 'branchId is required');
  }

  assertValidObjectId(resolvedBranchId, 'branchId');
  return resolvedBranchId;
}

function assertBranchAccess(user, branchId) {
  var roleName = user.roleName || (user.role && user.role.name) || '';
  var isOwner = roleName.toLowerCase().includes('owner');

  if (isOwner) {
    return; // Owner can manage all branches
  }

  if (user && user.branchId && user.branchId !== branchId) {
    throwHttpError(403, 'You do not have permission to manage rewards for this branch');
  }
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
  getRewards: getRewards,
  createReward: createReward,
  updateReward: updateReward,
  deleteReward: deleteReward
};
