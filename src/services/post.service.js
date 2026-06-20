var postRepository = require("../repositories/post.repository");
var branchRepository = require("../repositories/branch.repository");
var employeeRepository = require("../repositories/employee.repository");

async function getPosts(query) {
  var page = parsePositiveInt(query.page, 1);
  var limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  var skip = (page - 1) * limit;

  var items = await postRepository.findMany({
    skip: skip,
    take: limit,
    orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
  });
  var total = await postRepository.count({});

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

async function getPostById(id) {
  assertValidObjectId(id, "post id");

  var post = await postRepository.findById(id);
  if (!post) {
    throwHttpError(404, "Post not found");
  }

  return post;
}

async function createPost(payload) {
  var data = normalizePostPayload(payload, true);

  await assertBranchExists(data.branchId);
  await assertEmployeeExists(data.authorId);
  await assertUniqueSlug(data.slug);

  if (data.isPublished === true && data.publishedAt === undefined) {
    data.publishedAt = new Date();
  }

  return postRepository.create(data);
}

async function updatePost(id, payload) {
  assertValidObjectId(id, "post id");
  var current = await getPostById(id);

  var data = normalizePostPayload(payload, false);

  if (data.branchId !== undefined) {
    await assertBranchExists(data.branchId);
  }

  if (data.authorId !== undefined) {
    await assertEmployeeExists(data.authorId);
  }

  if (data.slug !== undefined) {
    await assertUniqueSlug(data.slug, id);
  }

  if (data.isPublished === true && data.publishedAt === undefined) {
    data.publishedAt = current.publishedAt || new Date();
  }

  return postRepository.update(id, data);
}

async function deletePost(id) {
  assertValidObjectId(id, "post id");
  await getPostById(id);

  return postRepository.remove(id);
}

async function assertUniqueSlug(slug, excludeId) {
  var existing = await postRepository.findBySlug(slug, excludeId);

  if (existing) {
    throwHttpError(409, "Post slug must be unique");
  }
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

async function assertEmployeeExists(employeeId) {
  if (!employeeId) {
    throwHttpError(400, "authorId is required");
  }

  var employee = await employeeRepository.findById(employeeId);
  if (!employee) {
    throwHttpError(404, "Employee not found");
  }
}

function normalizePostPayload(payload, isCreate) {
  var data = {};

  assignOptionalId(data, payload, "branchId");
  assignRequiredId(data, payload, "authorId", isCreate);
  assignRequiredString(data, payload, "slug", isCreate, true);
  assignRequiredString(data, payload, "title", isCreate);
  assignOptionalString(data, payload, "thumbnailUrl");
  assignRequiredString(data, payload, "content", isCreate);
  assignRequiredString(data, payload, "category", isCreate);
  assignOptionalString(data, payload, "tags");
  assignOptionalBoolean(data, payload, "isPublished");
  assignOptionalDate(data, payload, "publishedAt");

  if (Object.keys(data).length === 0) {
    throwHttpError(400, "Request body must include at least one valid field");
  }

  return data;
}

function assignRequiredId(data, payload, field, isRequired) {
  if (payload[field] === undefined) {
    if (isRequired) {
      throwHttpError(400, field + " is required");
    }

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
  getPosts: getPosts,
  getPostById: getPostById,
  createPost: createPost,
  updatePost: updatePost,
  deletePost: deletePost,
};
