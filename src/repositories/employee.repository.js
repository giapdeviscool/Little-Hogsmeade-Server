var prisma = require('../lib/prisma');

var EMPLOYEE_SELECT = {
  id: true,
  branchId: true,
  fullName: true,
  phone: true,
  email: true,
  avatarUrl: true,
  roleId: true,
  hiredDate: true,
  baseSalary: true,
  status: true,
  employeeType: true,
  // pinCode: EXCLUDED (BR-HR03)
  // passwordHash: EXCLUDED (BR-HR03)
  role: {
    select: {
      id: true,
      name: true
    }
  },
  branch: {
    select: {
      id: true,
      name: true,
      address: true
    }
  }
};

function findAll(options) {
  var query = {
    where: options.where || {},
    skip: options.skip || 0,
    take: options.take || 50,
    orderBy: options.orderBy || [
      { status: 'asc' },
      { hiredDate: 'desc' }
    ],
    select: EMPLOYEE_SELECT
  };

  return prisma.employee.findMany(query);
}

function count(where) {
  return prisma.employee.count({ where: where || {} });
}

function findById(id) {
  return prisma.employee.findUnique({
    where: { id: id },
    select: Object.assign({}, EMPLOYEE_SELECT, {
      pinCode: true,
      passwordHash: true
    })
  });
}

function findByPhone(phone, excludeId) {
  var where = { phone: phone };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.employee.findFirst({ where: where });
}

function findByEmail(email, excludeId) {
  if (!email) {
    return Promise.resolve(null);
  }

  var where = { email: email };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.employee.findFirst({ where: where });
}

function create(data) {
  return prisma.employee.create({
    data: data,
    select: EMPLOYEE_SELECT
  });
}

function update(id, data) {
  return prisma.employee.update({
    where: { id: id },
    data: data,
    select: EMPLOYEE_SELECT
  });
}

function hasOpenShift(employeeId) {
  return prisma.timesheet.count({
    where: {
      employeeId: employeeId,
      checkIn: { not: null },
      checkOut: null
    }
  });
}

function hasActiveAttendance(employeeId) {
  return prisma.timesheet.count({
    where: {
      employeeId: employeeId,
      checkIn: { not: null },
      checkOut: null,
      date: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    }
  });
}

function findRoleById(roleId) {
  return prisma.role.findUnique({
    where: { id: roleId }
  });
}

function findAllRoles() {
  return prisma.role.findMany({
    orderBy: { name: 'asc' }
  });
}

module.exports = {
  findAll: findAll,
  count: count,
  findById: findById,
  findByPhone: findByPhone,
  findByEmail: findByEmail,
  create: create,
  update: update,
  hasOpenShift: hasOpenShift,
  hasActiveAttendance: hasActiveAttendance,
  findRoleById: findRoleById,
  findAllRoles: findAllRoles
};
