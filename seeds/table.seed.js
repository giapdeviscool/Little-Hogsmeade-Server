var env = require('../src/config/env');
var prisma = require('../src/lib/prisma');

async function main() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required before running the table seed.');
  }

  var activeBranches = await prisma.branch.findMany({
    where: { status: 'active' },
    select: { id: true, name: true }
  });

  if (activeBranches.length === 0) {
    throw new Error('No active branches found in database. Please run npm run db:seed first.');
  }

  console.log('Clearing old areas and tables...');
  var activeBranchIds = activeBranches.map(function(b) { return b.id; });
  
  // Clean tables
  await prisma.table.deleteMany({
    where: {
      area: {
        branchId: { in: activeBranchIds }
      }
    }
  });

  // Clean areas
  await prisma.area.deleteMany({
    where: {
      branchId: { in: activeBranchIds }
    }
  });

  var createdTables = 0;

  for (var k = 0; k < activeBranches.length; k += 1) {
    var branch = activeBranches[k];
    console.log('Seeding randomized table layout for branch: ' + branch.name);

    // Define random counts for each area
    var areasConfig = [
      {
        name: 'Trong nhà',
        description: 'Khu vực có điều hòa',
        prefix: 'T1-',
        count: Math.floor(Math.random() * 5) + 6 // 6 to 10 tables
      },
      {
        name: 'Ngoài trời',
        description: 'Khu vực sân vườn',
        prefix: 'N-',
        count: Math.floor(Math.random() * 4) + 4 // 4 to 7 tables
      },
      {
        name: 'Quầy bar',
        description: 'Khu vực ghế cao tại quầy',
        prefix: 'B-',
        count: Math.floor(Math.random() * 3) + 2 // 2 to 4 tables
      }
    ];

    for (var i = 0; i < areasConfig.length; i += 1) {
      var areaConfig = areasConfig[i];
      
      // Create Area
      var area = await prisma.area.create({
        data: {
          branchId: branch.id,
          name: areaConfig.name,
          description: areaConfig.description
        }
      });

      // Create randomized tables for Area
      for (var j = 1; j <= areaConfig.count; j += 1) {
        var tableName = 'Bàn ' + areaConfig.prefix + String(j).padStart(2, '0');
        var capacities = [2, 4, 6, 8];
        var capacity = capacities[Math.floor(Math.random() * capacities.length)];

        await prisma.table.create({
          data: {
            areaId: area.id,
            name: tableName,
            capacity: capacity,
            status: 'available'
          }
        });
        createdTables += 1;
      }
    }
  }

  console.log('[seed] Randomized table layout completed for ' + activeBranches.length + ' active branches.');
  console.log('[seed] Total tables created across all branches: ' + createdTables);
}

main()
  .catch(function(e) {
    console.error(e);
    process.exit(1);
  })
  .finally(async function() {
    await prisma.$disconnect();
  });
