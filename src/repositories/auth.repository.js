var prisma = require('../lib/prisma');

function findCustomerByPhone(phone) {
  return prisma.customer.findUnique({
    where: { phone: phone }
  });
}

function findCustomerByEmail(email) {
  if (!email) {
    return Promise.resolve(null);
  }

  return prisma.customer.findUnique({
    where: { email: email }
  });
}

function findEmployeeByPhone(phone) {
  return prisma.employee.findUnique({
    where: { phone: phone }
  });
}

function findEmployeeByEmail(email) {
  if (!email) {
    return Promise.resolve(null);
  }

  return prisma.employee.findFirst({
    where: { email: email }
  });
}

function createCustomer(data) {
  return prisma.customer.create({
    data: data
  });
}

function createEmployee(data) {
  return prisma.employee.create({
    data: data
  });
}

module.exports = {
  findCustomerByPhone: findCustomerByPhone,
  findCustomerByEmail: findCustomerByEmail,
  findEmployeeByPhone: findEmployeeByPhone,
  findEmployeeByEmail: findEmployeeByEmail,
  createCustomer: createCustomer,
  createEmployee: createEmployee
};
