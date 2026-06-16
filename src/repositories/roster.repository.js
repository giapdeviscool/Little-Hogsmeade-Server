var prisma = require('../lib/prisma');

function findAll(options) {
  var where = {};

  if (options.branchId) where.branchId = options.branchId;
  if (options.employeeId) where.employeeId = options.employeeId;

  if (options.dateFrom && options.dateTo) {
    where.date = {
      gte: new Date(options.dateFrom),
      lte: new Date(options.dateTo)
    };
  }

  return prisma.roster.findMany({
    where: where,
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: {
      employee: {
        select: { id: true, fullName: true, status: true }
      },
      shift: {
        select: { id: true, name: true, startTime: true, endTime: true }
      },
      branch: {
        select: { id: true, name: true }
      }
    }
  });
}

function findById(id) {
  return prisma.roster.findUnique({
    where: { id: id },
    include: {
      employee: { select: { id: true, fullName: true, branchId: true, status: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      branch: { select: { id: true, name: true } }
    }
  });
}

function findOverlap(employeeId, date, shiftId, excludeId) {
  var where = {
    employeeId: employeeId,
    date: date,
    shiftId: shiftId
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.roster.findFirst({ where: where });
}

function findExistingRosters(employeeId, date) {
  return prisma.roster.findMany({
    where: {
      employeeId: employeeId,
      date: date
    },
    include: {
      shift: { select: { id: true, name: true, startTime: true, endTime: true } }
    }
  });
}

function create(data) {
  return prisma.roster.create({
    data: data,
    include: {
      employee: { select: { id: true, fullName: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      branch: { select: { id: true, name: true } }
    }
  });
}

function remove(id) {
  return prisma.roster.delete({
    where: { id: id }
  });
}

function count(where) {
  return prisma.roster.count({ where: where });
}

module.exports = {
  findAll: findAll,
  findById: findById,
  findOverlap: findOverlap,
  findExistingRosters: findExistingRosters,
  create: create,
  remove: remove,
  count: count
};
