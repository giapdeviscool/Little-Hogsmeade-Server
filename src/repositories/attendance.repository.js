var prisma = require('../lib/prisma');

function findEmployeeByPin(branchId) {
  var where = {
    status: 'active',
    pinCode: { not: '' }
  };
  if (branchId) {
    where.branchId = branchId;
  }
  return prisma.employee.findMany({
    where: where,
    select: {
      id: true,
      fullName: true,
      branchId: true,
      pinCode: true,
      status: true,
      role: { select: { id: true, name: true } }
    }
  });
}

function findOpenSession(employeeId, todayStart, todayEnd) {
  return prisma.timesheet.findFirst({
    where: {
      employeeId: employeeId,
      date: {
        gte: todayStart,
        lte: todayEnd
      },
      checkIn: { isSet: true },
      checkOut: { isSet: false }
    }
  });
}

function findTimesheetByShift(employeeId, shiftId, todayStart, todayEnd) {
  return prisma.timesheet.findFirst({
    where: {
      employeeId: employeeId,
      shiftId: shiftId,
      date: {
        gte: todayStart,
        lte: todayEnd
      }
    }
  });
}

function createTimesheet(data) {
  return prisma.timesheet.create({
    data: data,
    include: {
      employee: { select: { id: true, fullName: true } }
    }
  });
}

function updateTimesheet(id, data) {
  return prisma.timesheet.update({
    where: { id: id },
    data: data,
    include: {
      employee: { select: { id: true, fullName: true } }
    }
  });
}

function findTodayAttendance(branchId, todayStart, todayEnd) {
  var where = {
    date: {
      gte: todayStart,
      lte: todayEnd
    }
  };

  if (branchId) {
    where.employee = { branchId: branchId };
  }

  return prisma.timesheet.findMany({
    where: where,
    orderBy: { checkIn: 'desc' },
    include: {
      employee: { select: { id: true, fullName: true, branchId: true } },
      shift: { select: { id: true, name: true } }
    }
  });
}

module.exports = {
  findEmployeeByPin: findEmployeeByPin,
  findOpenSession: findOpenSession,
  createTimesheet: createTimesheet,
  updateTimesheet: updateTimesheet,
  findTodayAttendance: findTodayAttendance,
  findTimesheetByShift: findTimesheetByShift
};
