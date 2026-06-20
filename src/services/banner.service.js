var bannerRepository = require("../repositories/banner.repository");
var branchRepository = require("../repositories/branch.repository");

async function getBanners(query) {
  var page = parsePositiveInt(query.page, 1);
  var limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  var skip = (page - 1) * limit;

  var items = await bannerRepository.findMany({
    skip: skip,
    take: limit,
    orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
  });
  var total = await bannerRepository.count({});

  return {
    items: items,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getBannerById(id) {
  assertValidObjectId(id, "banner id");

  var banner = await bannerRepository.findById(id);
  if (!banner) {
    throwHttpError(404, "Banner not found");
  }

  return banner;
}

async function createBanner(payload) {
  var data = normalizeBannerPayload(payload, true);

  await assertBranchExists(data.branchId);

  return bannerRepository.create(data);
}

async function updateBanner(id, payload) {
  assertValidObjectId(id, "banner id");
  await getBannerById(id);

  var data = normalizeBannerPayload(payload, false);

  if (data.branchId !== undefined) {
    await assertBranchExists(data.branchId);
  }

  return bannerRepository.update(id, data);
}

async function deleteBanner(id) {
  assertValidObjectId(id, "banner id");
  await getBannerById(id);

  return bannerRepository.remove(id);
}

async function assertBranchExists(branchId) {
  if (branchId === undefined || branchId === null) {
    return;
  }

  var branch = await branchRepository.findById(branchId);
  if (!branch) {
    throwHttpError(404, "Branch not found");
  }
}

function normalizeBannerPayload(payload, isCreate) {
  var data = {};

  assignOptionalId(data, payload, "branchId");
  assignRequiredString(data, payload, "imageUrl", isCreate);
  assignOptionalString(data, payload, "title");
  assignOptionalString(data, payload, "subtitle");
  assignOptionalString(data, payload, "ctaUrl");
  assignOptionalNumber(data, payload, "displayOrder");
  assignOptionalBoolean(data, payload, "isActive");
  assignOptionalDate(data, payload, "startDate");
  assignOptionalDate(data, payload, "endDate");

  if (Object.keys(data).length === 0) {
    throwHttpError(400, "Request body must include at least one valid field");
  }

  return data;
}

function assignRequiredString(data, payload, field, isRequired) {
  if (payload[field] === undefined) {
    if (isRequired) {
      throwHttpError(400, field + " is required");
    }

    return;
  }

  if (typeof payload[field] !== "string" || payload[field].trim() === "") {
    throwHttpError(400, field + " must be a non-empty string");
  }

  data[field] = payload[field].trim();
}

function assignOptionalString(data, payload, field) {
  if (payload[field] === undefined) {
    return;
  }

  if (payload[field] === null || payload[field] === "") {
    data[field] = null;
    return;
  }

  if (typeof payload[field] !== "string") {
    throwHttpError(400, field + " must be a string");
  }

  data[field] = payload[field].trim();
}

function assignOptionalNumber(data, payload, field) {
  if (payload[field] === undefined) {
    return;
  }

  if (payload[field] === null || payload[field] === "") {
    throwHttpError(400, field + " must be a number");
  }

  var value = Number(payload[field]);
  if (!Number.isFinite(value)) {
    throwHttpError(400, field + " must be a number");
  }

  data[field] = value;
}

function assignOptionalBoolean(data, payload, field) {
  if (payload[field] === undefined) {
    return;
  }

  data[field] = parseBoolean(payload[field], field);
}

function assignOptionalDate(data, payload, field) {
  if (payload[field] === undefined) {
    return;
  }

  if (payload[field] === null || payload[field] === "") {
    data[field] = null;
    return;
  }

  var date = new Date(payload[field]);
  if (Number.isNaN(date.getTime())) {
    throwHttpError(400, field + " must be a valid date");
  }

  data[field] = date;
}

function assignOptionalId(data, payload, field) {
  if (payload[field] === undefined) {
    return;
  }

  if (payload[field] === null || payload[field] === "") {
    data[field] = null;
    return;
  }

  if (
    typeof payload[field] !== "string" ||
    !/^[a-f\d]{24}$/i.test(payload[field])
  ) {
    throwHttpError(400, field + " must be a valid ObjectId");
  }

  data[field] = payload[field];
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  var number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    throwHttpError(400, "Query value must be a positive integer");
  }

  return number;
}

function parseBoolean(value, fieldName) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    var normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  throwHttpError(400, fieldName + " must be a boolean");
}

function assertValidObjectId(value, fieldName) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throwHttpError(400, "Invalid " + fieldName);
  }
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  getBanners: getBanners,
  getBannerById: getBannerById,
  createBanner: createBanner,
  updateBanner: updateBanner,
  deleteBanner: deleteBanner,
};
