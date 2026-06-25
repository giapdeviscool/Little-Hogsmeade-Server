var prisma = require('../lib/prisma');

function getDb(tx) {
  return tx || prisma;
}

function findInvoiceById(invoiceId, tx) {
  return getDb(tx).invoice.findUnique({
    where: { id: invoiceId },
    include: {
      order: {
        include: {
          customer: true
        }
      }
    }
  });
}

function findPendingPaymentByRef(transactionRef, tx) {
  return getDb(tx).payment.findFirst({
    where: {
      transactionRef: transactionRef,
      status: 'pending'
    },
    include: {
      invoice: {
        include: {
          order: true
        }
      }
    }
  });
}

function createPayment(data, tx) {
  return getDb(tx).payment.create({
    data: data
  });
}

function updatePaymentStatus(paymentId, status, paidAt, tx) {
  return getDb(tx).payment.update({
    where: { id: paymentId },
    data: {
      status: status,
      paidAt: paidAt
    }
  });
}

function updateInvoiceStatus(invoiceId, status, tx) {
  return getDb(tx).invoice.update({
    where: { id: invoiceId },
    data: { status: status }
  });
}

function updateOrderStatus(orderId, status, tx) {
  return getDb(tx).order.update({
    where: { id: orderId },
    data: { status: status }
  });
}

function findActiveShiftByBranch(branchId, tx) {
  return getDb(tx).cashierShift.findFirst({
    where: {
      branchId: branchId,
      status: 'OPEN'
    }
  });
}

function incrementShiftExpectedCash(shiftId, amount, tx) {
  return getDb(tx).cashierShift.update({
    where: { id: shiftId },
    data: {
      expectedCashSystem: {
        increment: amount
      }
    }
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

function createPointTransaction(data, tx) {
  return getDb(tx).pointTransaction.create({
    data: data
  });
}

function updateInvoicePoints(invoiceId, pointsEarned, tx) {
  return getDb(tx).invoice.update({
    where: { id: invoiceId },
    data: { pointsEarned: pointsEarned }
  });
}

module.exports = {
  findInvoiceById: findInvoiceById,
  findPendingPaymentByRef: findPendingPaymentByRef,
  createPayment: createPayment,
  updatePaymentStatus: updatePaymentStatus,
  updateInvoiceStatus: updateInvoiceStatus,
  updateOrderStatus: updateOrderStatus,
  findActiveShiftByBranch: findActiveShiftByBranch,
  incrementShiftExpectedCash: incrementShiftExpectedCash,
  findLoyaltyConfigByBranch: findLoyaltyConfigByBranch,
  findCustomerMembershipByCustomerId: findCustomerMembershipByCustomerId,
  createCustomerMembership: createCustomerMembership,
  updateCustomerMembership: updateCustomerMembership,
  createPointTransaction: createPointTransaction,
  updateInvoicePoints: updateInvoicePoints
};
