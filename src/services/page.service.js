var pageRepository = require("../repositories/page.repository");
var branchRepository = require("../repositories/branch.repository");

async function getPages(query) {
  var page = parsePositiveInt(query.page, 1);
  var limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  var skip = (page - 1) * limit;

  var items = await pageRepository.findMany({
    skip: skip,
    take: limit,
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
  });
  var total = await pageRepository.count({});

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

async function getPageById(id) {
  assertValidObjectId(id, "page id");

  var page = await pageRepository.findById(id);
  if (!page) {
    throwHttpError(404, "Page not found");
  }

  return page;
}

async function createPage(payload) {
  var data = normalizePagePayload(payload, true);

  await assertBranchExists(data.branchId);

  if (data.slug) {
    await assertUniqueSlug(data.slug);
  }

  return pageRepository.create(data);
}

async function updatePage(id, payload) {
  assertValidObjectId(id, "page id");
  await getPageById(id);

  var data = normalizePagePayload(payload, false);

  if (data.branchId !== undefined) {
    await assertBranchExists(data.branchId);
  }

  if (data.slug !== undefined) {
    await assertUniqueSlug(data.slug, id);
  }

  data.updatedAt = new Date();

  return pageRepository.update(id, data);
}

async function deletePage(id) {
  assertValidObjectId(id, "page id");
  await getPageById(id);

  return pageRepository.remove(id);
}

async function assertUniqueSlug(slug, excludeId) {
  var existing = await pageRepository.findBySlug(slug, excludeId);

  if (existing) {
    throwHttpError(409, "Page slug must be unique");
  }
}

async function assertBranchExists(branchId) {
  if (!branchId) {
    return;
  }

  var branch = await branchRepository.findById(branchId);
  if (!branch) {
    throwHttpError(404, "Branch not found");
  }
}

function normalizePagePayload(payload, isCreate) {
  var data = {};

  assignOptionalId(data, payload, "branchId");
  assignRequiredString(data, payload, "slug", isCreate, true);
  assignRequiredString(data, payload, "title", isCreate);
  assignRequiredString(data, payload, "content", isCreate);

  if (payload.isPublished !== undefined) {
    data.isPublished = parseBoolean(payload.isPublished, "isPublished");
  }

  if (payload.imageUrl !== undefined) {
    data.imageUrl = payload.imageUrl;
  }

  if (payload.aboutTitle !== undefined) {
    data.aboutTitle = payload.aboutTitle;
  }

  if (payload.aboutContent !== undefined) {
    data.aboutContent = payload.aboutContent;
  }

  if (payload.yearsOfExperience !== undefined) {
    data.yearsOfExperience = parsePositiveInt(payload.yearsOfExperience, null);
  }

  if (Object.keys(data).length === 0) {
    throwHttpError(400, "Request body must include at least one valid field");
  }

  return data;
}

function assignRequiredString(data, payload, field, isRequired, normalizeSlug) {
  if (payload[field] === undefined) {
    if (isRequired) {
      throwHttpError(400, field + " is required");
    }

    return;
  }

  if (typeof payload[field] !== "string" || payload[field].trim() === "") {
    throwHttpError(400, field + " must be a non-empty string");
  }

  data[field] = normalizeSlug
    ? payload[field].trim().toLowerCase()
    : payload[field].trim();
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
  getPages: getPages,
  getPageById: getPageById,
  createPage: createPage,
  updatePage: updatePage,
  deletePage: deletePage,
};
