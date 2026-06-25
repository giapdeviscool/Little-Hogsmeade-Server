var prisma = require('../lib/prisma');

var membershipInclude = {
  customerMemberships: {
    orderBy: { updatedAt: 'desc' },
    take: 1,
    include: {
      tier: {
        select: {
          id: true,
          name: true
        }
      }
    }
  }
};

function findCustomerById(id, user) {
  var where = {
    id: id
  };

  if (user && user.type === 'employee') {
    where.branchId = user.branchId;
  }

  return prisma.customer.findUnique({
    where: where,
    include: membershipInclude
  });
}

function findCustomers(where, skip, take, orderBy) {
  return prisma.customer.findMany({
    where: where,
    skip: skip,
    take: take,
    orderBy: orderBy,
    include: membershipInclude
  });
}

function findCustomersForSort(where) {
  return prisma.customer.findMany({
    where: where,
    include: membershipInclude
  });
}

function countCustomers(where) {
  return prisma.customer.count({
    where: where
  });
}

function findCustomersByPhone(phone) {
  return prisma.customer.findMany({
    where: {
      phone: {
        contains: String(phone).trim()
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
}

function findCustomerOrders(customerId, skip, limit) {
  return prisma.order.findMany({
    where: { customerId: customerId },
    skip: skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      branch: { select: { name: true } },
      invoices: { select: { subtotal: true, discountAmount: true, totalAmount: true } },
      orderItems: {
        include: {
          menuItem: { select: { name: true } }
        }
      }
    }
  });
}

function countCustomerOrders(customerId) {
  return prisma.order.count({
    where: { customerId: customerId }
  });
}

function findCustomerPointTransactions(membershipIds, type, skip, limit) {
  var where = {
    customerMembershipId: { in: membershipIds }
  };
  if (type) {
    where.type = {
      equals: type.toLowerCase(),
      mode: 'insensitive'
    };
  }
  return prisma.pointTransaction.findMany({
    where: where,
    skip: skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
}

function countCustomerPointTransactions(membershipIds, type) {
  var where = {
    customerMembershipId: { in: membershipIds }
  };
  if (type) {
    where.type = {
      equals: type.toLowerCase(),
      mode: 'insensitive'
    };
  }
  return prisma.pointTransaction.count({
    where: where
  });
}

function findCustomerOrdersSummary(customerId) {
  return prisma.order.findMany({
    where: { customerId: customerId },
    select: {
      branchId: true,
      createdAt: true,
      branch: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
}

module.exports = {
  findCustomers: findCustomers,
  findCustomersForSort: findCustomersForSort,
  countCustomers: countCustomers,
  findCustomerById: findCustomerById,
  findCustomersByPhone: findCustomersByPhone,
  findCustomerOrders: findCustomerOrders,
  countCustomerOrders: countCustomerOrders,
  findCustomerPointTransactions: findCustomerPointTransactions,
  countCustomerPointTransactions: countCustomerPointTransactions,
  findCustomerOrdersSummary: findCustomerOrdersSummary
};
