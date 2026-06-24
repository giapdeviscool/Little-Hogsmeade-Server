var prisma = require('../lib/prisma');

function findActiveConfigByBranch(branchId) {
  return prisma.loyaltyConfig.findFirst({
    where: {
      branchId: branchId,
      isActive: true
    }
  });
}

function createConfig(data) {
  return prisma.loyaltyConfig.create({
    data: data
  });
}

function updateConfig(id, data) {
  return prisma.loyaltyConfig.update({
    where: { id: id },
    data: data
  });
}

module.exports = {
  findActiveConfigByBranch: findActiveConfigByBranch,
  createConfig: createConfig,
  updateConfig: updateConfig
};
