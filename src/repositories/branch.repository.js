var prisma = require('../lib/prisma');

function findAll(options) {
  return prisma.branch.findMany(options || {});
}

function count(where) {
  return prisma.branch.count({ where: where || {} });
}

function findById(id) {
  return prisma.branch.findUnique({ where: { id: id } });
}

function findActiveByGps(lat, lng, excludeId) {
  var where = {
    lat: lat,
    lng: lng,
    status: 'active'
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.branch.findFirst({ where: where });
}

function create(data) {
  return prisma.branch.create({ data: data });
}

function update(id, data) {
  return prisma.branch.update({
    where: { id: id },
    data: data
  });
}

function hasPendingOrders(branchId) {
  return prisma.order.count({
    where: {
      branchId: branchId,
      status: { in: ['pending', 'Pending'] }
    }
  });
}

function hasReservedTables(branchId) {
  return prisma.reservation.count({
    where: {
      branchId: branchId,
      status: { in: ['pending', 'reserved', 'Reserved'] }
    }
  });
}

function countActiveEmployees(branchId) {
  return prisma.employee.count({
    where: { branchId: branchId, status: 'active' }
  });
}

function countOpenCashierShifts(branchId) {
  return prisma.cashierShift.count({
    where: { branchId: branchId, status: 'OPEN' }
  });
}

module.exports = {
  findAll: findAll,
  count: count,
  findById: findById,
  findActiveByGps: findActiveByGps,
  create: create,
  update: update,
  hasPendingOrders: hasPendingOrders,
  hasReservedTables: hasReservedTables,
  countActiveEmployees: countActiveEmployees,
  countOpenCashierShifts: countOpenCashierShifts
};
