var crmCustomerRepository = require('../repositories/crm-customer.repository');
var authMiddleware = require('../middlewares/auth.middleware');

var DEFAULT_PAGE = 1;
var DEFAULT_LIMIT = 20;
var MAX_LIMIT = 100;
var DEFAULT_TIER = 'MEMBER';
var SORT_FIELDS = {
  total_spent: 'total_spent',
  created_at: 'created_at',
  current_points: 'current_points'
};

async function getCustomerById(customerId, user) {
  if (!customerId) {
    throwHttpError(400, 'customerId is required');
  }

  var customer = await crmCustomerRepository.findCustomerById(customerId);

  if (!customer) {
    throwHttpError(404, 'Customer not found');
  }

  return formatCustomerItem(customer, user);
}

async function getCustomers(user, query) {
  var page = parseRequiredPositiveInt(query && query.page, 'page', DEFAULT_PAGE);
  var limit = Math.min(parseRequiredPositiveInt(query && query.limit, 'limit', DEFAULT_LIMIT), MAX_LIMIT);
  var where = buildCustomerWhere(query);
  var sortBy = parseSortBy(query && query.sort_by);
  var sortOrder = parseSortOrder(query && query.sort_order);
  var total;
  var items;

  if (sortBy === SORT_FIELDS.created_at) {
    total = await crmCustomerRepository.countCustomers(where);
    items = await crmCustomerRepository.findCustomers(
      where,
      (page - 1) * limit,
      limit,
      { createdAt: sortOrder }
    );
  } else {
    var customers = await crmCustomerRepository.findCustomersForSort(where);
    customers = sortCustomers(customers, sortBy, sortOrder);
    total = customers.length;
    items = customers.slice((page - 1) * limit, page * limit);
  }

  return {
    items: items.map(function(customer) {
      return formatCustomerItem(customer, user);
    }),
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

function buildCustomerWhere(query) {
  var where = {};
  var andConditions = [];

  if (query && query.search) {
    var keyword = String(query.search).trim();

    andConditions.push({
      OR: [
        {
          fullName: {
            contains: keyword,
            mode: 'insensitive'
          }
        },
        {
          phone: {
            contains: keyword
          }
        }
      ]
    });
  }

  if (query && query.tier) {
    var tierName = String(query.tier).trim().toUpperCase();

    if (tierName === DEFAULT_TIER) {
      andConditions.push({
        OR: [
          {
            customerMemberships: {
              none: {}
            }
          },
          {
            customerMemberships: {
              some: {
                tier: {
                  name: {
                    equals: tierName,
                    mode: 'insensitive'
                  }
                }
              }
            }
          }
        ]
      });
    } else {
      andConditions.push({
        customerMemberships: {
          some: {
            tier: {
              name: {
                equals: tierName,
                mode: 'insensitive'
              }
            }
          }
        }
      });
    }
  }

  if (andConditions.length === 1) {
    return andConditions[0];
  }

  if (andConditions.length > 1) {
    return { AND: andConditions };
  }

  return where;
}

function sortCustomers(customers, sortBy, sortOrder) {
  var sorted = customers.slice();

  sorted.sort(function(a, b) {
    var aValue = getSortValue(a, sortBy);
    var bValue = getSortValue(b, sortBy);

    if (aValue === bValue) {
      return 0;
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    }

    return aValue < bValue ? 1 : -1;
  });

  return sorted;
}

function getSortValue(customer, sortBy) {
  var membership = getPrimaryMembership(customer);

  if (sortBy === SORT_FIELDS.total_spent) {
    return membership ? membership.totalSpent : 0;
  }

  if (sortBy === SORT_FIELDS.current_points) {
    return membership ? membership.totalPoints : 0;
  }

  return customer.createdAt ? new Date(customer.createdAt).getTime() : 0;
}

function getPrimaryMembership(customer) {
  if (!customer.customerMemberships || customer.customerMemberships.length === 0) {
    return null;
  }

  return customer.customerMemberships[0];
}

function formatCustomerItem(customer, user) {
  var membership = getPrimaryMembership(customer);
  var tier = membership && membership.tier
    ? String(membership.tier.name).toUpperCase()
    : DEFAULT_TIER;
  var totalPoints = membership ? membership.totalPoints : 0;
  var totalSpent = membership ? membership.totalSpent : 0;
  var joinedDate = membership ? membership.joinedAt : customer.createdAt;
  var phone = formatPhone(customer.phone, user);
  return {
    id: customer.id,
    full_name: customer.fullName,
    phone: phone,
    avatar_url: customer.avatarUrl || null,
    tier: tier,
    membership_tier: tier,
    total_points: totalPoints,
    current_points: totalPoints,
    total_spent: totalSpent,
    joined_date: joinedDate
  };
}

async function searchByPhone(phone) {
  if (!phone || !String(phone).trim()) {
    throwHttpError(400, 'phone is required');
  }

  var customers = await crmCustomerRepository.findCustomersByPhone(phone);

  return customers.map(function(customer) {
    return {
      id: customer.id,
      phone: customer.phone,
      fullName: customer.fullName,
      email: customer.email || null,
      birthday: customer.birthday || null,
      avatarUrl: customer.avatarUrl || null,
      createdAt: customer.createdAt,
      source: customer.source
    };
  });
}

function formatPhone(phone, user) {
  if (!phone) {
    return phone;
  }

  if (canViewFullPhone(user)) {
    return phone;
  }

  if (phone.length <= 7) {
    return phone;
  }

  return phone.slice(0, 4) + '***' + phone.slice(-3);
}

function canViewFullPhone(user) {
  return authMiddleware.isOwner(user);
}

function parseSortBy(value) {
  var sortBy = String(value || SORT_FIELDS.created_at).trim().toLowerCase();

  if (!SORT_FIELDS[sortBy]) {
    throwHttpError(400, 'sort_by must be total_spent, created_at, or current_points');
  }

  return SORT_FIELDS[sortBy];
}

function parseSortOrder(value) {
  var sortOrder = String(value || 'desc').trim().toLowerCase();

  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throwHttpError(400, 'sort_order must be asc or desc');
  }

  return sortOrder;
}

function parseRequiredPositiveInt(value, fieldName, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  var parsed = parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throwHttpError(400, fieldName + ' must be a positive integer');
  }

  return parsed;
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}


async function getCustomerDetail(customerId, user) {
  if (!customerId) {
    throwHttpError(400, 'customerId is required');
  }

  var customer = await crmCustomerRepository.findCustomerById(customerId);

  if (!customer) {
    var error = new Error('Customer not found');
    error.statusCode = 404;
    error.code = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  var membership = getPrimaryMembership(customer);
  var tier = membership && membership.tier
    ? String(membership.tier.name).toUpperCase()
    : DEFAULT_TIER;
  var totalPoints = membership ? membership.totalPoints : 0;
  var totalSpent = membership ? membership.totalSpent : 0;
  var joinedDate = membership ? membership.joinedAt : customer.createdAt;
  var phone = formatPhone(customer.phone, user);

  var ordersSummary = await crmCustomerRepository.findCustomerOrdersSummary(customerId);
  
  var lastVisitDate = null;
  if (ordersSummary.length > 0) {
    lastVisitDate = ordersSummary[0].createdAt.toISOString();
  }

  var favoriteBranch = null;
  if (ordersSummary.length > 0) {
    var branchCounts = {};
    var branchNames = {};
    for (var i = 0; i < ordersSummary.length; i++) {
      var order = ordersSummary[i];
      var bId = order.branchId;
      branchCounts[bId] = (branchCounts[bId] || 0) + 1;
      if (order.branch && order.branch.name) {
        branchNames[bId] = order.branch.name;
      }
    }
    
    var favoriteBranchId = null;
    var maxCount = 0;
    for (var bId in branchCounts) {
      if (branchCounts[bId] > maxCount) {
        maxCount = branchCounts[bId];
        favoriteBranchId = bId;
      }
    }
    if (favoriteBranchId) {
      favoriteBranch = branchNames[favoriteBranchId] || null;
    }
  }

  var dob = null;
  if (customer.birthday) {
    dob = customer.birthday.toISOString().split('T')[0];
  }

  function mapRegistrationSource(source) {
    if (!source) return "POS_IN_STORE";
    var s = source.toLowerCase();
    if (s === 'walk-in' || s === 'pos' || s === 'pos_in_store') {
      return "POS_IN_STORE";
    }
    if (s === 'web' || s === 'online-register' || s === 'online_register') {
      return "WEB";
    }
    if (s === 'app' || s === 'mobile-app' || s === 'mobile_app') {
      return "APP";
    }
    return source.toUpperCase().replace(/[-\s]/g, '_');
  }

  return {
    id: customer.id,
    full_name: customer.fullName,
    phone: phone,
    raw_phone: customer.phone,
    email: customer.email || null,
    gender: customer.gender || "MALE",
    dob: dob,
    membership_tier: tier,
    current_points: totalPoints,
    total_spent: totalSpent,
    joined_date: joinedDate.toISOString(),
    last_visit_date: lastVisitDate,
    registration_source: mapRegistrationSource(customer.source),
    favorite_branch: favoriteBranch
  };
}

async function getCustomerOrders(customerId, query) {
  if (!customerId) {
    throwHttpError(400, 'customerId is required');
  }

  var customer = await crmCustomerRepository.findCustomerById(customerId);
  if (!customer) {
    var error = new Error('Customer not found');
    error.statusCode = 404;
    error.code = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  var page = parseRequiredPositiveInt(query && query.page, 'page', 1);
  var limit = parseRequiredPositiveInt(query && query.limit, 'limit', 10);
  var skip = (page - 1) * limit;

  var total = await crmCustomerRepository.countCustomerOrders(customerId);
  var orders = await crmCustomerRepository.findCustomerOrders(customerId, skip, limit);

  var items = orders.map(function(order) {
    var invoice = order.invoices && order.invoices[0];
    var totalAmount = invoice ? invoice.subtotal : order.orderItems.reduce(function(acc, item) { return acc + item.subtotal; }, 0);
    var discountAmount = invoice ? invoice.discountAmount : 0;
    var finalAmount = invoice ? invoice.totalAmount : totalAmount;

    var itemStrings = order.orderItems.map(function(item) {
      return item.quantity + 'x ' + (item.menuItem ? item.menuItem.name : '');
    });
    var briefItems = itemStrings.slice(0, 3).join(', ');
    if (itemStrings.length > 3) {
      briefItems += '...';
    }

    var yyStr = new Date(order.createdAt).toISOString().slice(2, 10).replace(/-/g, '');

    return {
      order_id: order.id,
      order_code: 'ORD-' + yyStr + '-' + order.id.slice(-3).toUpperCase(),
      branch_name: order.branch ? order.branch.name : null,
      order_date: order.createdAt.toISOString(),
      total_amount: totalAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      status: order.status.toUpperCase(),
      brief_items: briefItems
    };
  });

  return {
    items: items,
    pagination: {
      total_items: total,
      current_page: page,
      total_pages: Math.ceil(total / limit) || 1,
      limit: limit
    }
  };
}

async function getCustomerPoints(customerId, query) {
  if (!customerId) {
    throwHttpError(400, 'customerId is required');
  }

  var customer = await crmCustomerRepository.findCustomerById(customerId);
  if (!customer) {
    var error = new Error('Customer not found');
    error.statusCode = 404;
    error.code = 'CUSTOMER_NOT_FOUND';
    throw error;
  }

  var membershipIds = customer.customerMemberships
    ? customer.customerMemberships.map(function(m) { return m.id; })
    : [];

  var page = parseRequiredPositiveInt(query && query.page, 'page', 1);
  var limit = parseRequiredPositiveInt(query && query.limit, 'limit', 10);
  var type = query && query.type;

  var skip = (page - 1) * limit;

  var total = await crmCustomerRepository.countCustomerPointTransactions(membershipIds, type);
  var transactions = await crmCustomerRepository.findCustomerPointTransactions(membershipIds, type, skip, limit);

  var items = transactions.map(function(tx) {
    return {
      transaction_id: tx.id,
      transaction_type: tx.type.toUpperCase(),
      points_changed: tx.points,
      description: tx.note || '',
      created_at: tx.createdAt.toISOString()
    };
  });

  return {
    items: items,
    pagination: {
      total_items: total,
      current_page: page,
      total_pages: Math.ceil(total / limit) || 1,
      limit: limit
    }
  };
}

module.exports = {
  getCustomers: getCustomers,
  searchByPhone: searchByPhone,
  getCustomerById: getCustomerById,
  getCustomerDetail: getCustomerDetail,
  getCustomerOrders: getCustomerOrders,
  getCustomerPoints: getCustomerPoints
};
