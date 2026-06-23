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
  findOrderItemsByOrderId: findOrderItemsByOrderId,
  deleteOrderItemToppingsByOrderItemIds: deleteOrderItemToppingsByOrderItemIds,
  deleteOrderItemsByOrderId: deleteOrderItemsByOrderId,
  deletePointTransactionsByOrderId: deletePointTransactionsByOrderId,
  deletePaymentsByInvoiceId: deletePaymentsByInvoiceId,
  deleteInvoiceByOrderId: deleteInvoiceByOrderId,
  deleteOrderById: deleteOrderById
};
