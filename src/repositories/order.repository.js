var prisma = require('../lib/prisma');

function getDb(tx) {
  return tx || prisma;
}

function createOrder(data, tx) {
  // Build data object with all required fields and relations
  const createData = Object.assign({}, data, {
    orderType: data.orderType,
    createdAt: data.createdAt || new Date(),
    updatedAt: new Date()
  });

  // Convert branchId scalar to branch relation connect
  if (createData.branchId && !createData.branch) {
    createData.branch = { connect: { id: createData.branchId } };
    delete createData.branchId;
  }

  // Convert employeeId scalar to employee relation connect
  if (createData.employeeId && !createData.employee) {
    createData.employee = { connect: { id: createData.employeeId } };
    delete createData.employeeId;
  }

  // Handle optional customerId: convert to customer relation connect if provided
  if (createData.customerId && !createData.customer) {
    createData.customer = { connect: { id: createData.customerId } };
    delete createData.customerId;
  }

  // Remove customerId if null to avoid relation issues
  if (createData.customerId === null) {
    delete createData.customerId;
    delete createData.customer;
  }

  // Handle optional tableId as a relation, like branch and employee above.
  if (createData.tableId && !createData.table) {
    createData.table = { connect: { id: createData.tableId } };
    delete createData.tableId;
  }

  if (createData.tableId === null) {
    delete createData.tableId;
    delete createData.table;
  }

  // Handle optional cashierShiftId as a relation
  if (createData.cashierShiftId && !createData.cashierShift) {
    createData.cashierShift = { connect: { id: createData.cashierShiftId } };
    delete createData.cashierShiftId;
  }

  if (createData.cashierShiftId === null) {
    delete createData.cashierShiftId;
    delete createData.cashierShift;
  }

  // DEBUG: show what is being sent to Prisma (remove in production)
  try {
    console.log('[order.repository] createData:', JSON.stringify(createData));
  } catch (e) {
    console.log('[order.repository] createData: <unserializable>');
  }

  return getDb(tx).order.create({
    data: createData,
    include: {
      branch: true,
      employee: true,
      customer: true,
      orderItems: true,
      invoices: true
    }
  });
}

function createOrderItem(data, tx) {
  return getDb(tx).orderItem.create({
    data: data
  });
}

function createOrderItemTopping(data, tx) {
  return getDb(tx).orderItemTopping.create({
    data: data
  });
}

function createInvoice(data, tx) {
  return getDb(tx).invoice.create({
    data: data
  });
}

function createPayment(data, tx) {
  return getDb(tx).payment.create({
    data: data
  });
}

function findLoyaltyConfigByBranch(branchId, tx) {
  return getDb(tx).loyaltyConfig.findFirst({
    where: {
      branchId: branchId,
      isActive: true
    }
  });
}

function findCustomerMembershipByCustomerId(customerId, tx) {
  if (!customerId) {
    return null;
  }
  return getDb(tx).customerMembership.findFirst({
    where: {
      customerId: customerId
    }
  });
}

function createCustomerMembership(data, tx) {
  return getDb(tx).customerMembership.create({
    data: data
  });
}

function updateCustomerMembership(id, data, tx) {
  return getDb(tx).customerMembership.update({
    where: { id: id },
    data: data
  });
}

function updateInvoice(id, data, tx) {
  return getDb(tx).invoice.update({
    where: { id: id },
    data: data
  });
}

function createPointTransaction(data, tx) {
  return getDb(tx).pointTransaction.create({
    data: data
  });
}

function findOrderById(id, tx) {
  return getDb(tx).order.findUnique({
    where: { id: id }
  });
}

function updateOrderStatus(id, status, tx) {
  return getDb(tx).order.update({
    where: { id: id },
    data: { status: status }
  });
}

function findInvoiceByOrderId(orderId, tx) {
  return getDb(tx).invoice.findFirst({
    where: { orderId: orderId }
  });
}

function updateInvoiceStatusByOrderId(orderId, status, tx) {
  return getDb(tx).invoice.update({
    where: { orderId: orderId },
    data: { status: status }
  });
}

function updatePaymentStatusByInvoiceId(invoiceId, status, tx) {
  return getDb(tx).payment.updateMany({
    where: { invoiceId: invoiceId },
    data: { status: status }
  });
}

function updatePaymentAmountByInvoiceId(invoiceId, amount, tx) {
  return getDb(tx).payment.updateMany({
    where: { invoiceId: invoiceId },
    data: { amount: amount }
  });
}

function findOrderItemsByOrderId(orderId, tx) {
  return getDb(tx).orderItem.findMany({
    where: { orderId: orderId }
  });
}

function deleteOrderItemToppingsByOrderItemIds(orderItemIds, tx) {
  return getDb(tx).orderItemTopping.deleteMany({
    where: { orderItemId: { in: orderItemIds } }
  });
}

function deleteOrderItemsByOrderId(orderId, tx) {
  return getDb(tx).orderItem.deleteMany({
    where: { orderId: orderId }
  });
}

function deletePointTransactionsByOrderId(orderId, tx) {
  return getDb(tx).pointTransaction.deleteMany({
    where: { orderId: orderId }
  });
}

function deletePaymentsByInvoiceId(invoiceId, tx) {
  return getDb(tx).payment.deleteMany({
    where: { invoiceId: invoiceId }
  });
}

function deleteInvoiceByOrderId(orderId, tx) {
  return getDb(tx).invoice.deleteMany({
    where: { orderId: orderId }
  });
}

function deleteOrderById(id, tx) {
  return getDb(tx).order.delete({
    where: { id: id }
  });
}

async function countPendingOrdersForBranch(branchId, tx) {
  var db = getDb(tx);
  var openStatuses = ['pending', 'confirmed', 'preparing', 'in_progress', 'serving', 'open'];
  
  var count = await db.order.count({
    where: {
      branchId: branchId,
      status: {
        in: openStatuses
      }
    }
  });
  
  return count;
}

async function calculateCashRevenueForShift(branchId, tx) {
  var db = getDb(tx);
  var invoices = await db.invoice.findMany({
    where: {
      order: {
        branchId: branchId
      },
      status: 'paid'
    },
    include: {
      payments: true,
      order: true
    }
  });

  var cashSales = 0;
  var cashRefunds = 0;

  for (var i = 0; i < invoices.length; i++) {
    var invoice = invoices[i];

    for (var j = 0; j < invoice.payments.length; j++) {
      var payment = invoice.payments[j];
      if (payment.method === 'cash') {
        if (payment.status === 'completed' || payment.status === 'success') {
          cashSales += payment.amount;
        } else if (payment.status === 'refunded') {
          cashRefunds += payment.amount;
        }
      }
    }
  }

  return {
    cashSales: cashSales,
    cashRefunds: cashRefunds
  };
}

function findCusomterByPhone(phone, tx) {
  return getDb(tx).customer.findUnique({
    where: { phone: phone }
  });
}

function createCustomer(data, tx) {
  return getDb(tx).customer.create({
    data: data
  });
}

module.exports = {
  createOrder: createOrder,
  createOrderItem: createOrderItem,
  createOrderItemTopping: createOrderItemTopping,
  createInvoice: createInvoice,
  createPayment: createPayment,
  findLoyaltyConfigByBranch: findLoyaltyConfigByBranch,
  findCustomerMembershipByCustomerId: findCustomerMembershipByCustomerId,
  createCustomerMembership: createCustomerMembership,
  updateCustomerMembership: updateCustomerMembership,
  updateInvoice: updateInvoice,
  createPointTransaction: createPointTransaction,
  findOrderById: findOrderById,
  updateOrderStatus: updateOrderStatus,
  findInvoiceByOrderId: findInvoiceByOrderId,
  updateInvoiceStatusByOrderId: updateInvoiceStatusByOrderId,
  updatePaymentStatusByInvoiceId: updatePaymentStatusByInvoiceId,
  updatePaymentAmountByInvoiceId: updatePaymentAmountByInvoiceId,
  findOrderItemsByOrderId: findOrderItemsByOrderId,
  deleteOrderItemToppingsByOrderItemIds: deleteOrderItemToppingsByOrderItemIds,
  deleteOrderItemsByOrderId: deleteOrderItemsByOrderId,
  deletePointTransactionsByOrderId: deletePointTransactionsByOrderId,
  deletePaymentsByInvoiceId: deletePaymentsByInvoiceId,
  deleteInvoiceByOrderId: deleteInvoiceByOrderId,
  deleteOrderById: deleteOrderById,
  findCusomterByPhone: findCusomterByPhone,
  createCustomer: createCustomer,
  countPendingOrdersForBranch: countPendingOrdersForBranch,
  calculateCashRevenueForShift: calculateCashRevenueForShift
};
