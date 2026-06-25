const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check active shift and its expectedCashSystem
  const shift = await p.cashierShift.findFirst({ where: { status: 'OPEN' } });
  console.log('ACTIVE SHIFT:', JSON.stringify(shift, null, 2));
  
  // Count successful cash payments
  const cashPayments = await p.payment.findMany({
    where: { method: 'cash', status: 'success' },
    select: { id: true, amount: true, invoiceId: true }
  });
  console.log('CASH PAYMENTS COUNT:', cashPayments.length);
  console.log('TOTAL CASH:', cashPayments.reduce((s, pay) => s + pay.amount, 0));
}

main().catch(console.error).finally(() => p.$disconnect());
