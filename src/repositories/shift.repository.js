var prisma = require('../lib/prisma');

function findAll(options) {
  var where = { status: 'active' };

  if (options && options.branchId) {
    where.branchId = options.branchId;
  }

  return prisma.shift.findMany({
    where: where,
    orderBy: { startTime: 'asc' },
    include: {
      branch: {
        select: { id: true, name: true }
      }
    }
  });
}

function findById(id) {
  return prisma.shift.findUnique({
    where: { id: id },
    include: {
      branch: {
        select: { id: true, name: true }
      }
    }
  });
}

function findByNameAndBranch(name, branchId, excludeId) {
  var where = {
    name: { equals: name, mode: 'insensitive' },
    branchId: branchId,
    status: 'active'
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.shift.findFirst({ where: where });
}

function create(data) {
  return prisma.shift.create({
    data: data,
    include: {
      branch: { select: { id: true, name: true } }
    }
  });
}

function update(id, data) {
  return prisma.shift.update({
    where: { id: id },
    data: data,
    include: {
      branch: { select: { id: true, name: true } }
    }
  });
}

function hasLinkedTimesheets(shiftId) {
  return prisma.timesheet.count({
    where: { shiftId: shiftId }
  });
}

function hasLinkedRosters(shiftId) {
  return prisma.roster.count({
    where: { shiftId: shiftId }
  });
}

module.exports = {
  findAll: findAll,
  findById: findById,
  findByNameAndBranch: findByNameAndBranch,
  create: create,
  update: update,
  hasLinkedTimesheets: hasLinkedTimesheets,
  hasLinkedRosters: hasLinkedRosters
};
