const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Finding pending payments...');
  
  const pendingPayments = await prisma.payment.findMany({
    where: { status: 'pending' },
    include: {
      invoice: {
        include: {
          order: true
        }
      }
    }
  });

  console.log(`Found ${pendingPayments.length} pending payments. Processing...`);

  for (const payment of pendingPayments) {
    const invoice = payment.invoice;
    const order = invoice.order;

    await prisma.$transaction(async (tx) => {
      // 1. Update payment to cash & success
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'success',
          method: 'cash',
          paidAt: new Date(),
          cashReceived: payment.amount,
          cashChangeDue: 0
        }
      });

      // 2. Update Invoice to paid
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'paid' }
      });

      // 3. Update Order to paid
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'paid' }
      });

      // 4. Increment Shift Expected Cash
      const activeShift = await tx.cashierShift.findFirst({
        where: {
          branchId: order.branchId,
          status: 'OPEN'
        }
      });
      if (activeShift) {
        await tx.cashierShift.update({
          where: { id: activeShift.id },
          data: {
            expectedCashSystem: {
              increment: payment.amount
            }
          }
        });
      }

      // 5. Process Loyalty Points
      if (order.customerId) {
        const loyaltyConfig = await tx.loyaltyConfig.findFirst({
          where: { branchId: order.branchId, isActive: true }
        });
        
        if (loyaltyConfig && loyaltyConfig.spendPerPoint > 0) {
          const pointsEarned = Math.floor(invoice.totalAmount / loyaltyConfig.spendPerPoint);

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { pointsEarned: pointsEarned }
          });

          let membership = await tx.customerMembership.findFirst({
            where: { customerId: order.customerId }
          });

          if (!membership) {
            const defaultTier = await tx.membershipTier.findFirst({
              where: { minPoints: 0 }
            });
            if (defaultTier) {
              membership = await tx.customerMembership.create({
                data: {
                  customerId: order.customerId,
                  tierId: defaultTier.id,
                  totalPoints: 0,
                  totalSpent: 0
                }
              });
            }
          }

          if (membership) {
            const updatedMembership = await tx.customerMembership.update({
              where: { id: membership.id },
              data: {
                totalPoints: membership.totalPoints + pointsEarned,
                totalSpent: membership.totalSpent + invoice.totalAmount
              }
            });

            await tx.pointTransaction.create({
              data: {
                customerMembershipId: updatedMembership.id,
                orderId: order.id,
                type: 'earn',
                points: pointsEarned,
                note: 'Loyalty points earned for paid order (seeded)'
              }
            });
          }
        }
      }
    });

    console.log(`Successfully updated payment ${payment.id} for invoice ${invoice.id}`);
  }

  console.log('Seeding complete.');
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
