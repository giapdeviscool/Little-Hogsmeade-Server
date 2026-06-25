var prisma = require('../lib/prisma');

function findRewards(filters, skip, take) {
  return prisma.loyaltyReward.findMany({
    where: filters,
    skip: skip,
    take: take,
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

function countRewards(filters) {
  return prisma.loyaltyReward.count({
    where: filters
  });
}

function findRewardById(id) {
  return prisma.loyaltyReward.findFirst({
    where: {
      id: id,
      isDeleted: false
    },
    include: {
      product: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
}

function createReward(data) {
  return prisma.loyaltyReward.create({
    data: data
  });
}

function updateReward(id, data) {
  return prisma.loyaltyReward.update({
    where: { id: id },
    data: data
  });
}

module.exports = {
  findRewards: findRewards,
  countRewards: countRewards,
  findRewardById: findRewardById,
  createReward: createReward,
  updateReward: updateReward
};
