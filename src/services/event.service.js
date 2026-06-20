var eventRepository = require("../repositories/event.repository");
var branchRepository = require("../repositories/branch.repository");

async function getEvents(query) {
  var page = parsePositiveInt(query.page, 1);
  var limit = Math.min(parsePositiveInt(query.limit, 20), 100);
  var skip = (page - 1) * limit;

  var items = await eventRepository.findMany({
    skip: skip,
    take: limit,
    orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
  });
  var total = await eventRepository.count({});

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

async function getEventById(id) {
  assertValidObjectId(id, "event id");

  var event = await eventRepository.findById(id);
  if (!event) {
    throwHttpError(404, "Event not found");
  }

  return event;
}

async function createEvent(payload) {
  var data = normalizeEventPayload(payload, true);

  await assertBranchExists(data.branchId);

  return eventRepository.create(data);
}

async function updateEvent(id, payload) {
  assertValidObjectId(id, "event id");
  await getEventById(id);

  var data = normalizeEventPayload(payload, false);

  if (data.branchId !== undefined) {
    await assertBranchExists(data.branchId);
  }

  return eventRepository.update(id, data);
}

async function deleteEvent(id) {
  assertValidObjectId(id, "event id");
  await getEventById(id);

  return eventRepository.remove(id);
}

async function assertBranchExists(branchId) {
  if (!branchId) {
    throwHttpError(400, "branchId is required");
  }

  var branch = await branchRepository.findById(branchId);
  if (!branch) {
    throwHttpError(404, "Branch not found");
  }
}

function normalizeEventPayload(payload, isCreate) {
  var data = {};

  assignRequiredId(data, payload, "branchId", isCreate);
  assignRequiredString(data, payload, "title", isCreate);
  assignRequiredString(data, payload, "description", isCreate);
  assignOptionalString(data, payload, "thumbnailUrl");
  assignRequiredDate(data, payload, "eventDate", isCreate);
  assignRequiredDate(data, payload, "startTime", isCreate);
  assignRequiredDate(data, payload, "endTime", isCreate);
  assignOptionalString(data, payload, "locationNote");
  assignOptionalNumber(data, payload, "ticketPrice");
  assignOptionalBoolean(data, payload, "isPublished");

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

function assignRequiredDate(data, payload, field, isRequired) {
  if (payload[field] === undefined) {
    if (isRequired) {
      throwHttpError(400, field + " is required");
    }

    return;
  }

  var date = new Date(payload[field]);
  if (Number.isNaN(date.getTime())) {
    throwHttpError(400, field + " must be a valid date");
  }

  data[field] = date;
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
  getEvents: getEvents,
  getEventById: getEventById,
  createEvent: createEvent,
  updateEvent: updateEvent,
  deleteEvent: deleteEvent,
};
