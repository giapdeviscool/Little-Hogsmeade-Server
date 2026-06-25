const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const shift = await p.cashierShift.findFirst({ where: { status: 'OPEN' } });
  if (!shift) {
    console.log('No open shift found.');
    return;
  }

  console.log('Current shift:', shift.id);
  console.log('expectedCashSystem (before):', shift.expectedCashSystem);
  console.log('startingFloat:', shift.startingFloat);

  // Sum all successful cash payments for orders belonging to this branch
  const cashPayments = await p.payment.findMany({
    where: {
      method: 'cash',
      status: 'success',
      invoice: {
        order: {
          branchId: shift.branchId
        }
      }
    },
    select: { amount: true }
  });

  const totalCash = cashPayments.reduce((s, pay) => s + pay.amount, 0);
  console.log(`Found ${cashPayments.length} cash payments totaling ${totalCash}`);

  const newExpected = shift.startingFloat + totalCash;
  console.log('New expectedCashSystem:', newExpected);

  await p.cashierShift.update({
    where: { id: shift.id },
    data: { expectedCashSystem: newExpected }
  });

  console.log('Shift backfilled successfully!');
}

main().catch(console.error).finally(() => p.$disconnect());
