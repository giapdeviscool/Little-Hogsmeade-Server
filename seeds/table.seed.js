var env = require('../src/config/env');
var prisma = require('../src/lib/prisma');

var BRANCH_NAME = 'Little Hogsmeade Flagship';

var LAYOUT = [
  {
    name: 'Trong nhà',
    description: 'Khu vực có điều hòa',
    tables: [
      ['Bàn T1-01', 4], ['Bàn T1-02', 2], ['Bàn T1-03', 4], ['Bàn T1-04', 4],
      ['Bàn T1-05', 6], ['Bàn T1-06', 2], ['Bàn T1-07', 4], ['Bàn T1-08', 4]
    ]
  },
  {
    name: 'Ngoài trời',
    description: 'Khu vực sân vườn',
    tables: [
      ['Bàn N-01', 4], ['Bàn N-02', 4], ['Bàn N-03', 6], ['Bàn N-04', 2]
    ]
  },
  {
    name: 'Quầy bar',
    description: 'Khu vực ghế cao tại quầy',
    tables: [
      ['Bàn B-01', 2], ['Bàn B-02', 2], ['Bàn B-03', 2]
    ]
  }
];

async function main() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required before running the table seed.');
  }

  var branch = await prisma.branch.findFirst({
    where: { name: BRANCH_NAME },
    select: { id: true, name: true }
  });

  if (!branch) {
    throw new Error('Branch not found: ' + BRANCH_NAME + '. Run npm run db:seed first.');
  }

  var createdTables = 0;

  for (var i = 0; i < LAYOUT.length; i += 1) {
    var areaConfig = LAYOUT[i];
    var area = await upsertArea(branch.id, areaConfig);

    for (var j = 0; j < areaConfig.tables.length; j += 1) {
      var tableConfig = areaConfig.tables[j];
      await upsertTable(area.id, tableConfig[0], tableConfig[1]);
      createdTables += 1;
    }
  }

  console.log('[seed] Table layout completed for ' + branch.name);
  console.log('[seed] Areas: ' + LAYOUT.length + ', tables: ' + createdTables + ', existing POS state preserved');
}

async function upsertArea(branchId, data) {
  var existing = await prisma.area.findFirst({
    where: {
      branchId: branchId,
      name: data.name
    }
  });

  if (existing) {
    return prisma.area.update({
      where: { id: existing.id },
      data: { description: data.description }
    });
  }

  return prisma.area.create({
    data: {
      branchId: branchId,
      name: data.name,
      description: data.description
    }
  });
}

async function upsertTable(areaId, name, capacity) {
  var existing = await prisma.table.findFirst({
    where: {
      areaId: areaId,
      name: name
    }
  });

  if (existing) {
    return prisma.table.update({
      where: { id: existing.id },
      // Layout seed must not reset live POS state or unlink orders/reservations.
      data: {
        name: name,
        capacity: capacity
      }
    });
  }

  return prisma.table.create({
    data: {
      areaId: areaId,
      name: name,
      capacity: capacity,
      status: 'available'
    }
  });
}

main()
  .catch(function(error) {
    console.error('[seed] Table layout failed');
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(function() {
    return prisma.$disconnect();
  });
