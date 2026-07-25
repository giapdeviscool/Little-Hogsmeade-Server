var prisma = require('../lib/prisma');

function getDb(tx) {
  return tx || prisma;
}

function createCashierShift(data, tx) {
  return getDb(tx).cashierShift.create({
    data: data,
  });
}

function findActiveCashierShiftByBranch(branchId, tx) {
  return getDb(tx).cashierShift.findFirst({
    where: {
      branchId: branchId,
      status: 'OPEN',
    },
  });
}

function findCashierShiftById(id, tx) {
  return getDb(tx).cashierShift.findUnique({
    where: { id: id },
  });
}

function updateCashierShift(id, data, tx) {
  return getDb(tx).cashierShift.update({
    where: { id: id },
    data: data,
  });
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

async function incrementShiftExpectedCash(shiftId, amount, tx) {
  var db = getDb(tx);
  var shift = await db.cashierShift.findUnique({
    where: { id: shiftId },
    select: { expectedCashSystem: true, startingFloat: true }
  });
  var current = shift && shift.expectedCashSystem !== null
    ? shift.expectedCashSystem
    : (shift ? shift.startingFloat : 0);
  return db.cashierShift.update({
    where: { id: shiftId },
    data: {
      expectedCashSystem: current + amount
    }
  });
}

module.exports = {
  createCashierShift: createCashierShift,
  findActiveCashierShiftByBranch: findActiveCashierShiftByBranch,
  findCashierShiftById: findCashierShiftById,
  updateCashierShift: updateCashierShift,
  calculateCashRevenueForShift: calculateCashRevenueForShift,
  incrementShiftExpectedCash: incrementShiftExpectedCash,
};
