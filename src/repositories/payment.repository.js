var prisma = require('../lib/prisma');

function getDb(tx) {
  return tx || prisma;
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

function deletePaymentsByInvoiceId(invoiceId, tx) {
  return getDb(tx).payment.deleteMany({
    where: { invoiceId: invoiceId }
  });
}

module.exports = {
  findPendingPaymentByRef: findPendingPaymentByRef,
  createPayment: createPayment,
  updatePaymentStatus: updatePaymentStatus,
  updatePaymentStatusByInvoiceId: updatePaymentStatusByInvoiceId,
  updatePaymentAmountByInvoiceId: updatePaymentAmountByInvoiceId,
  deletePaymentsByInvoiceId: deletePaymentsByInvoiceId
};
