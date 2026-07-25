var prisma = require('../lib/prisma');

function getDb(tx) {
  return tx || prisma;
}

function findActiveConfigByBranch(branchId, tx) {
  return getDb(tx).loyaltyConfig.findFirst({
    where: {
      branchId: branchId,
      isActive: true
    }
  });
}

function createConfig(data, tx) {
  return getDb(tx).loyaltyConfig.create({
    data: data
  });
}

function updateConfig(id, data, tx) {
  return getDb(tx).loyaltyConfig.update({
    where: { id: id },
    data: data
  });
}

function findLoyaltyConfigByBranch(branchId, tx) {
  return getDb(tx).loyaltyConfig.findFirst({
    where: {
      branchId: branchId,
      isActive: true
    }
  });
}

function findCustomerMembershipByCustomerId(customerId, tx) {
  if (!customerId) {
    return null;
  }
  return getDb(tx).customerMembership.findFirst({
    where: {
      customerId: customerId
    }
  });
}

function createCustomerMembership(data, tx) {
  return getDb(tx).customerMembership.create({
    data: data
  });
}

function updateCustomerMembership(id, data, tx) {
  return getDb(tx).customerMembership.update({
    where: { id: id },
    data: data
  });
}

function createPointTransaction(data, tx) {
  return getDb(tx).pointTransaction.create({
    data: data
  });
}

function deletePointTransactionsByOrderId(orderId, tx) {
  return getDb(tx).pointTransaction.deleteMany({
    where: { orderId: orderId }
  });
}

module.exports = {
  findActiveConfigByBranch: findActiveConfigByBranch,
  createConfig: createConfig,
  updateConfig: updateConfig,
  findLoyaltyConfigByBranch: findLoyaltyConfigByBranch,
  findCustomerMembershipByCustomerId: findCustomerMembershipByCustomerId,
  createCustomerMembership: createCustomerMembership,
  updateCustomerMembership: updateCustomerMembership,
  createPointTransaction: createPointTransaction,
  deletePointTransactionsByOrderId: deletePointTransactionsByOrderId
};
