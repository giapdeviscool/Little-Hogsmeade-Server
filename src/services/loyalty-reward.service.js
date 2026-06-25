var loyaltyRewardRepository = require('../repositories/loyalty-reward.repository');
var menuItemRepository = require('../repositories/menu-item.repository');

var REWARD_TYPES = ['VOUCHER', 'FREE_PRODUCT'];
var REWARD_STATUSES = ['active', 'inactive'];
var DEFAULT_PAGE = 1;
var DEFAULT_LIMIT = 10;
var MAX_LIMIT = 100;
var MIN_REQUIRED_POINTS = 1;

async function getRewards(user, query) {
  var branchId = resolveBranchId(user, query && query.branchId);
  var page = parsePositiveInt(query && query.page, DEFAULT_PAGE);
  var limit = Math.min(parsePositiveInt(query && query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  var skip = (page - 1) * limit;
  var filters = {
    branchId: branchId,
    isDeleted: false
  };

  if (query && query.search) {
    filters.name = {
      contains: String(query.search).trim(),
      mode: 'insensitive'
    };
  }

  if (query && query.reward_type) {
    filters.rewardType = parseRewardType(query.reward_type);
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
  var branchId = resolveBranchId(user, (payload && payload.branchId) || (query && query.branchId));
  var data = buildRewardData(payload, branchId);

  await validateProductForReward(data.rewardType, data.productId, branchId);

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
  
  if (data.productId !== undefined || data.rewardType !== undefined) {
    var rewardType = data.rewardType !== undefined ? data.rewardType : reward.rewardType;
    var productId = data.productId !== undefined ? data.productId : reward.productId;
    await validateProductForReward(rewardType, productId, reward.branchId);
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
    status: 'inactive',
    isDeleted: true,
    updatedAt: new Date()
  });
}

function buildRewardData(payload, branchId) {
  if (!payload || !payload.name || !String(payload.name).trim()) {
    throwHttpError(400, 'name is required');
  }

  var rewardType = parseRewardType(payload.reward_type);
  var requiredPoints = parseRequiredPoints(payload.required_points);
  var status = payload.status !== undefined ? parseStatus(payload.status) : 'active';
  var discountValue = normalizeNumber(payload.discount_value);
  var minOrderValue = normalizeNumber(payload.min_order_value);
  var productId = payload.product_id || null;

  validateRewardTypeFields(rewardType, discountValue, minOrderValue, productId);

  return {
    branchId: branchId,
    name: String(payload.name).trim(),
    requiredPoints: requiredPoints,
    rewardType: rewardType,
    discountValue: discountValue,
    minOrderValue: minOrderValue,
    productId: productId,
    description: payload.description ? String(payload.description).trim() : null,
    imageUrl: payload.image_url ? String(payload.image_url).trim() : null,
    status: status
  };
}

function buildRewardUpdateData(payload, reward) {
  if (!payload || typeof payload !== 'object') {
    throwHttpError(400, 'Request body is required');
  }

  var data = {
    updatedAt: new Date()
  };

  if (payload.name !== undefined) {
    if (!String(payload.name).trim()) {
      throwHttpError(400, 'name must be a non-empty string');
    }

    data.name = String(payload.name).trim();
  }

  if (payload.required_points !== undefined) {
    data.requiredPoints = parseRequiredPoints(payload.required_points);
  }

  if (payload.reward_type !== undefined) {
    data.rewardType = parseRewardType(payload.reward_type);
  }

  if (payload.discount_value !== undefined) {
    data.discountValue = normalizeNumber(payload.discount_value);
  }

  if (payload.min_order_value !== undefined) {
    data.minOrderValue = normalizeNumber(payload.min_order_value);
  }

  if (payload.product_id !== undefined) {
    data.productId = payload.product_id || null;
  }

  if (payload.description !== undefined) {
    data.description = payload.description ? String(payload.description).trim() : null;
  }

  if (payload.image_url !== undefined) {
    data.imageUrl = payload.image_url ? String(payload.image_url).trim() : null;
  }

  if (payload.status !== undefined) {
    data.status = parseStatus(payload.status);
  }

  var rewardType = data.rewardType !== undefined ? data.rewardType : reward.rewardType;
  var discountValue = data.discountValue !== undefined ? data.discountValue : reward.discountValue;
  var minOrderValue = data.minOrderValue !== undefined ? data.minOrderValue : reward.minOrderValue;
  var productId = data.productId !== undefined ? data.productId : reward.productId;

  validateRewardTypeFields(rewardType, discountValue, minOrderValue, productId);

  return data;
}

function validateRewardTypeFields(rewardType, discountValue, minOrderValue, productId) {
  if (rewardType === 'VOUCHER') {
    if (discountValue <= 0) {
      throwHttpError(400, 'discount_value must be greater than 0 for VOUCHER rewards');
    }

    if (minOrderValue < 0) {
      throwHttpError(400, 'min_order_value must be greater than or equal to 0');
    }

    return;
  }

  if (!productId) {
    throwHttpError(400, 'product_id is required for FREE_PRODUCT rewards');
  }

  assertValidObjectId(productId, 'product_id');
}

async function validateProductForReward(rewardType, productId, branchId) {
  if (rewardType !== 'FREE_PRODUCT') {
    return;
  }

  var product = await menuItemRepository.findMenuItemById(productId);

  if (!product || !product.isActive) {
    throwHttpError(400, 'product_id must reference an active menu item');
  }

  if (product.branchId && product.branchId !== branchId) {
    throwHttpError(400, 'product_id must belong to the same branch');
  }
}

function formatRewardResponse(reward) {
  var item = {
    id: reward.id,
    name: reward.name,
    required_points: reward.requiredPoints,
    reward_type: reward.rewardType,
    discount_value: reward.discountValue,
    min_order_value: reward.minOrderValue,
    product_id: reward.productId,
    status: reward.status,
    description: reward.description || null
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
    throwHttpError(400, 'required_points must be greater than or equal to ' + MIN_REQUIRED_POINTS);
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
