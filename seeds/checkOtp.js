const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const employees = await p.employee.findMany({
    select: { id: true, fullName: true, totpSecret: true }
  });
  for (const e of employees) {
    console.log(`${e.fullName} | totpSecret: ${e.totpSecret ? 'SET (' + e.totpSecret.substring(0,8) + '...)' : 'NULL'}`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
