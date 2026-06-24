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

module.exports = {
  createCashierShift: createCashierShift,
  findActiveCashierShiftByBranch: findActiveCashierShiftByBranch,
  findCashierShiftById: findCashierShiftById,
  updateCashierShift: updateCashierShift,
};
