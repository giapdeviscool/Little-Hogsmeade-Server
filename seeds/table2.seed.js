var env = require('../src/config/env');
var prisma = require('../src/lib/prisma');

async function main() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  console.log('Resetting all tables to available...');
  await prisma.table.updateMany({
    data: {
      status: 'available',
      currentOrderId: null,
      reservationId: null,
      guestCount: null,
      note: null
    }
  });

  console.log('[seed] All tables have been successfully set to available (trống hết).');
}

main()
  .catch(function(e) {
    console.error(e);
    process.exit(1);
  })
  .finally(async function() {
    await prisma.$disconnect();
  });
