var prisma = require('../lib/prisma');

async function findInvoices(filters, skip, limit, sortBy, sortOrder) {
  var where = {};

  // Date range filter
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  // Status filter
  if (filters.status) {
    where.status = filters.status;
  }

  // Order ID filter
  if (filters.orderId) {
    where.orderId = filters.orderId;
  }

  // Invoice ID filter
  if (filters.id) {
    where.id = filters.id;
  }

  // Payment Method filter
  if (filters.paymentMethod) {
    where.payments = {
      some: {
        method: filters.paymentMethod
      }
    };
  }

  // Order level filters (branchId, employeeId, cashierShiftId, customerName)
  if (filters.branchId || filters.employeeId || filters.cashierShiftId || filters.customerName) {
    where.order = {};
    if (filters.branchId) {
      where.order.branchId = filters.branchId;
    }
    if (filters.employeeId) {
      where.order.employeeId = filters.employeeId;
    }
    if (filters.cashierShiftId) {
      where.order.cashierShiftId = filters.cashierShiftId;
    }
    if (filters.customerName) {
      where.order.customer = {
        fullName: {
          contains: filters.customerName,
          mode: 'insensitive'
        }
      };
    }
  }

  // Amount range filter
  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    where.totalAmount = {};
    if (filters.minAmount !== undefined) {
      where.totalAmount.gte = filters.minAmount;
    }
    if (filters.maxAmount !== undefined) {
      where.totalAmount.lte = filters.maxAmount;
    }
  }

  var orderBy = {};
  orderBy[sortBy] = sortOrder;

  var dataPromise = prisma.invoice.findMany({
    where: where,
    skip: skip,
    take: limit,
    orderBy: orderBy,
    include: {
      payments: true,
      order: {
        select: {
          id: true,
          branchId: true,
          orderType: true,
          employeeId: true,
          customerId: true,
          tableId: true,
          status: true,
          createdAt: true,
          customer: {
            select: {
              fullName: true,
              phone: true
            }
          }
        }
      }
    }
  });

  var countPromise = prisma.invoice.count({
    where: where
  });

  var results = await Promise.all([dataPromise, countPromise]);

  return {
    data: results[0],
    totalCount: results[1]
  };
}

function findInvoiceById(id) {
  return prisma.invoice.findUnique({
    where: { id: id },
    include: {
      payments: true,
      order: {
        include: {
          customer: {
            select: {
              fullName: true,
              phone: true
            }
          },
          orderItems: {
            include: {
              menuItem: true,
              orderItemToppings: {
                include: {
                  topping: true
                }
              }
            }
          },
          pointTransactions: true,
          employee: {
            select: {
              fullName: true
            }
          }
        }
      }
    }
  });
}

async function findAdminInvoices(filters, skip, limit) {
  var where = {};

  if (filters.branchId) {
    where.order = where.order || {};
    where.order.branchId = filters.branchId;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.paymentMethod) {
    where.payments = {
      some: {
        method: filters.paymentMethod
      }
    };
  }

  if (filters.cashierId) {
    where.order = where.order || {};
    where.order.employeeId = filters.cashierId;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  var dataPromise = prisma.invoice.findMany({
    where: where,
    skip: skip,
    take: limit,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      payments: true,
      order: {
        include: {
          employee: true,
          customer: true,
          orderItems: {
            include: {
              menuItem: true
            }
          }
        }
      }
    }
  });

  var countPromise = prisma.invoice.count({
    where: where
  });

  var results = await Promise.all([dataPromise, countPromise]);

  return {
    data: results[0],
    totalCount: results[1]
  };
}

module.exports = {
  findInvoices: findInvoices,
  findInvoiceById: findInvoiceById,
  findAdminInvoices: findAdminInvoices
};
