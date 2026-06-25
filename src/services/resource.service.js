var resourceRepository = require('../repositories/resource.repository');

function normalizeListOptions(query) {
  var options = {};
  var take = parsePositiveInt(query.limit);
  var skip = parsePositiveInt(query.skip);

  if (take !== null) {
    options.take = Math.min(take, 100);
  }

  if (skip !== null) {
    options.skip = skip;
  }

  // Handle sorting
  var sortKey = query._sort || query.sort_by;
  var sortOrder = query._order || query.sort_order;
  if (sortKey) {
    var order = sortOrder && sortOrder.toLowerCase() === 'desc' ? 'desc' : 'asc';
    options.orderBy = {};
    options.orderBy[sortKey] = order;
  }

  // Handle filtering for query parameters
  var where = {};
  var ignoredKeys = ['limit', 'skip', 'page', 'sort_by', 'sort_order', '_sort', '_order', '_expand', '_embed'];
  for (var key in query) {
    if (ignoredKeys.includes(key)) {
      continue;
    }
    var val = query[key];
    if (val !== undefined && val !== null && val !== '') {
      if (val === 'true') {
        where[key] = true;
      } else if (val === 'false') {
        where[key] = false;
      } else {
        where[key] = val;
      }
    }
  }
  if (Object.keys(where).length > 0) {
    options.where = where;
  }

  // Handle dynamic relations (_expand)
  if (query._expand) {
    options.include = {};
    var relations = Array.isArray(query._expand) ? query._expand : [query._expand];
    relations.forEach(function(rel) {
      options.include[rel] = true;
    });
  }

  return options;
}

async function getItems(resource, query) {
  return resourceRepository.findMany(resource, normalizeListOptions(query || {}));
}

async function getItemById(resource, id) {
  assertValidId(id, resource.name);

  var item = await resourceRepository.findById(resource, id);
  if (!item) {
    throwHttpError(404, resource.model + ' not found');
  }

  return item;
}

async function createItem(resource, payload) {
  assertPlainObject(payload);

  return resourceRepository.create(resource, payload);
}

async function updateItem(resource, id, payload) {
  assertValidId(id, resource.name);
  assertPlainObject(payload);
  await getItemById(resource, id);

  return resourceRepository.update(resource, id, payload);
}

async function deleteItem(resource, id) {
  assertValidId(id, resource.name);
  await getItemById(resource, id);

  return resourceRepository.remove(resource, id);
}

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  var number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throwHttpError(400, 'Query value must be a positive integer');
  }

  return number;
}

function assertPlainObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throwHttpError(400, 'Request body must be an object');
  }
}

function assertValidId(id, resourceName) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throwHttpError(400, 'Invalid ' + resourceName + ' id');
  }
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  getItems: getItems,
  getItemById: getItemById,
  createItem: createItem,
  updateItem: updateItem,
  deleteItem: deleteItem
};
