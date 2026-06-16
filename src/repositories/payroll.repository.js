var prisma = require('../lib/prisma');

function findTimesheets(options) {
  var where = {};

  if (options.employeeId) {
    where.employeeId = options.employeeId;
  }

  if (options.branchId) {
    where.employee = { branchId: options.branchId };
  }

  if (options.monthStart && options.monthEnd) {
    where.date = {
      gte: options.monthStart,
      lte: options.monthEnd
    };
  }

  return prisma.timesheet.findMany({
    where: where,
    orderBy: { date: 'asc' },
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          branchId: true,
          baseSalary: true,
          status: true,
          role: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } }
        }
      },
      shift: {
        select: { id: true, name: true, startTime: true, endTime: true }
      }
    }
  });
}

function findEmployeesForPayroll(options) {
  var where = {};

  if (options.branchId) {
    where.branchId = options.branchId;
  }

  if (options.employeeId) {
    where.id = options.employeeId;
  }

  return prisma.employee.findMany({
    where: where,
    select: {
      id: true,
      fullName: true,
      baseSalary: true,
      branchId: true,
      status: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } }
    },
    orderBy: { fullName: 'asc' }
  });
}

module.exports = {
  findTimesheets: findTimesheets,
  findEmployeesForPayroll: findEmployeesForPayroll
};
