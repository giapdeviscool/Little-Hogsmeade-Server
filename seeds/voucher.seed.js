var env = require('../src/config/env');
var prisma = require('../src/lib/prisma');

async function main() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  console.log('[seed] Seeding campaigns and vouchers...');

  try {
    await prisma.$transaction(async function(tx) {
      // 1. Seed Campaigns & Vouchers
      var campaignWelcome = await upsertCampaign(tx, {
        name: 'M4 - Chain Welcome Week',
        description: 'Chiến dịch chào mừng tuần lễ khai trương',
        startDate: new Date('2026-06-01T00:00:00Z'),
        endDate: new Date('2026-06-30T00:00:00Z'),
        discountValue: 10,
        discountType: 'percent',
        isActive: true
      });

      var voucherWelcome = await upsertVoucher(tx, {
        campaignId: campaignWelcome.id,
        code: 'WELCOME10',
        type: 'percent',
        discountValue: 10,
        minOrderValue: 0,
        startDate: new Date('2026-06-01T00:00:00Z'),
        expireDate: new Date('2026-06-30T00:00:00Z')
      });

      var campaignGold = await upsertCampaign(tx, {
        name: 'M4 - Gold Member Reward',
        description: 'Đổi điểm lấy Voucher giảm giá 50.000đ',
        startDate: new Date('2026-06-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
        discountValue: 50000,
        discountType: 'fixed',
        isActive: true
      });

      var voucherGold = await upsertVoucher(tx, {
        campaignId: campaignGold.id,
        code: 'GOLD50K',
        type: 'fixed',
        discountValue: 50000,
        minOrderValue: 150000,
        startDate: new Date('2026-06-01T00:00:00Z'),
        expireDate: new Date('2026-12-31T00:00:00Z')
      });

      var campaignSunset = await upsertCampaign(tx, {
        name: 'M4 - Sunset Buffet Reward',
        description: 'Đổi Voucher buffet chiều hoàng hôn',
        startDate: new Date('2026-06-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
        discountValue: 200000,
        discountType: 'fixed',
        isActive: true
      });

      var voucherSunset = await upsertVoucher(tx, {
        campaignId: campaignSunset.id,
        code: 'SUNSETBUFFET',
        type: 'fixed',
        discountValue: 200000,
        minOrderValue: 300000,
        startDate: new Date('2026-06-01T00:00:00Z'),
        expireDate: new Date('2026-12-31T00:00:00Z')
      });

      // 2. Clear old VoucherUsages linked to these vouchers to keep it idempotent
      await tx.voucherUsage.deleteMany({
        where: {
          voucherId: { in: [voucherWelcome.id, voucherGold.id, voucherSunset.id] }
        }
      });

      // 3. Link customer orders with matching discount amounts to these vouchers
      // Nguyen Van A (0987654321) -> Order 2 (discount: 50k) -> GOLD50K
      var customerA = await tx.customer.findUnique({ where: { phone: '0987654321' } });
      if (customerA) {
        var orderA = await tx.order.findFirst({
          where: { customerId: customerA.id, invoices: { some: { discountAmount: 50000 } } },
          include: { invoices: true }
        });
        if (orderA && orderA.invoices[0]) {
          await tx.invoice.update({
            where: { id: orderA.invoices[0].id },
            data: { voucherId: voucherGold.id }
          });
          await tx.voucherUsage.create({
            data: {
              voucherId: voucherGold.id,
              customerId: customerA.id,
              orderId: orderA.id,
              usedAt: orderA.createdAt
            }
          });
        }
      }

      // Customers with 10% discounts -> WELCOME10
      var tenPercentCustomers = ['0987654323', '0987654325', '0987654326', '0987654327'];
      for (var i = 0; i < tenPercentCustomers.length; i++) {
        var phone = tenPercentCustomers[i];
        var customerObj = await tx.customer.findUnique({ where: { phone: phone } });
        if (customerObj) {
          var orderObj = await tx.order.findFirst({
            where: { customerId: customerObj.id, invoices: { some: { discountAmount: { gt: 0 } } } },
            include: { invoices: true }
          });
          if (orderObj && orderObj.invoices[0]) {
            await tx.invoice.update({
              where: { id: orderObj.invoices[0].id },
              data: { voucherId: voucherWelcome.id }
            });
            await tx.voucherUsage.create({
              data: {
                voucherId: voucherWelcome.id,
                customerId: customerObj.id,
                orderId: orderObj.id,
                usedAt: orderObj.createdAt
              }
            });
          }
        }
      }

      // 4. Seed Loyalty Rewards for all branches in the system
      var dbBranches = await tx.branch.findMany();
      
      // Clean up previous seeded loyalty rewards first to maintain idempotency
      await tx.loyaltyReward.deleteMany({
        where: {
          name: { in: ['Voucher giảm giá 50.000đ', 'Tặng 1 ly Latte miễn phí'] }
        }
      });

      for (var j = 0; j < dbBranches.length; j++) {
        var branch = dbBranches[j];

        // Voucher reward
        await tx.loyaltyReward.create({
          data: {
            branchId: branch.id,
            name: 'Voucher giảm giá 50.000đ',
            requiredPoints: 100,
            rewardType: 'VOUCHER',
            discountValue: 50000,
            minOrderValue: 150000,
            description: 'Đổi 100 điểm để nhận voucher giảm 50.000đ cho hóa đơn từ 150.000đ',
            status: 'active'
          }
        });

        // Product reward (find an active menu item for this branch or globally)
        var rewardProduct = await tx.menuItem.findFirst({
          where: { branchId: branch.id, isActive: true }
        });
        if (!rewardProduct) {
          rewardProduct = await tx.menuItem.findFirst({
            where: { branchId: null, isActive: true }
          });
        }

        if (rewardProduct) {
          await tx.loyaltyReward.create({
            data: {
              branchId: branch.id,
              name: 'Tặng 1 ly Latte miễn phí',
              requiredPoints: 50,
              rewardType: 'FREE_PRODUCT',
              productId: rewardProduct.id,
              description: 'Đổi 50 điểm để nhận 1 phần nước uống Latte miễn phí',
              status: 'active'
            }
          });
        }
      }

      console.log('Seeded campaigns, vouchers, voucher usages, and loyalty rewards successfully.');
    });
  } catch (error) {
    console.error('[seed] Seeding vouchers failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function upsertCampaign(tx, data) {
  var existing = await tx.campaign.findFirst({
    where: { name: data.name }
  });
  if (existing) {
    return tx.campaign.update({
      where: { id: existing.id },
      data: data
    });
  }
  return tx.campaign.create({ data: data });
}

async function upsertVoucher(tx, data) {
  var existing = await tx.voucher.findUnique({
    where: { code: data.code }
  });
  if (existing) {
    return tx.voucher.update({
      where: { id: existing.id },
      data: data
    });
  }
  return tx.voucher.create({ data: data });
}

main();
