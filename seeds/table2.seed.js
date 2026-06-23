var env = require('../src/config/env');
var prisma = require('../src/lib/prisma');

var BRANCH_NAME = 'Little Hogsmeade Flagship';
var DEMO_ORDER_NOTE = '[POS_DEMO] occupied-table-order';
var DEMO_RESERVATION_PHONE = '0900000091';

async function main() {
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required before running the POS table seed.');
  }

  var result = await prisma.$transaction(async function(tx) {
    var branch = await tx.branch.findFirst({
      where: { name: BRANCH_NAME },
      select: { id: true, name: true }
    });

    if (!branch) {
      throw new Error('Branch not found: ' + BRANCH_NAME + '. Run npm run db:seed-tables first.');
    }

    var tables = await tx.table.findMany({
      where: {
        area: { branchId: branch.id },
        name: { in: ['Bàn B-01', 'Bàn N-01'] }
      },
      select: { id: true, name: true }
    });
    var occupiedTable = findByName(tables, 'Bàn B-01');
    var reservedTable = findByName(tables, 'Bàn N-01');

    if (!occupiedTable || !reservedTable) {
      throw new Error('Required tables Bàn B-01 and Bàn N-01 were not found. Run npm run db:seed-tables first.');
    }

    var employee = await upsertDemoEmployee(tx, branch.id);
    var menuItems = await tx.menuItem.findMany({
      where: { branchId: branch.id },
      orderBy: { name: 'asc' },
      take: 2,
      select: { id: true, name: true, basePrice: true }
    });

    if (menuItems.length < 2) {
      throw new Error('At least two menu items are required for the POS demo seed.');
    }

    var order = await upsertOccupiedOrder(tx, branch.id, employee.id, occupiedTable.id, menuItems);
    var reservation = await upsertReservation(tx, branch.id, reservedTable.id);

    await tx.table.update({
      where: { id: occupiedTable.id },
      data: {
        status: 'occupied',
        currentOrderId: order.id,
        reservationId: null,
        guestCount: 2,
        note: 'POS demo: current order'
      }
    });

    await tx.table.update({
      where: { id: reservedTable.id },
      data: {
        status: 'reserved',
        currentOrderId: null,
        reservationId: reservation.id,
        guestCount: reservation.guestCount,
        note: reservation.note
      }
    });

    return {
      branch: branch.name,
      occupiedTable: occupiedTable.name,
      orderId: order.id,
      orderItems: menuItems.length,
      reservedTable: reservedTable.name,
      reservationId: reservation.id
    };
  }, {
    maxWait: 10000,
    timeout: 60000
  });

  console.log('[seed] POS table demo completed');
  console.log(JSON.stringify(result, null, 2));
}

async function upsertDemoEmployee(tx, branchId) {
  var role = await tx.role.findFirst({ select: { id: true } });
  if (!role) {
    throw new Error('No role found. Run npm run db:seed before running the POS table seed.');
  }

  var existing = await tx.employee.findFirst({
    where: { phone: '09000004064' }
  });
  var data = {
    branchId: branchId,
    fullName: 'POS Demo Cashier',
    phone: '09000004064',
    email: 'pos-demo-cashier@little-hogsmeade.test',
    roleId: role.id,
    hiredDate: new Date(),
    baseSalary: 0,
    status: 'active',
    pinCode: '4064'
  };

  if (existing) {
    return tx.employee.update({ where: { id: existing.id }, data: data });
  }

  return tx.employee.create({ data: data });
}

async function upsertOccupiedOrder(tx, branchId, employeeId, tableId, menuItems) {
  var existing = await tx.order.findFirst({
    where: { branchId: branchId, note: DEMO_ORDER_NOTE },
    select: { id: true }
  });
  var orderData = {
    branchId: branchId,
    tableId: tableId,
    employeeId: employeeId,
    orderType: 'dine-in',
    status: 'pending',
    note: DEMO_ORDER_NOTE
  };
  var order;

  if (existing) {
    order = await tx.order.update({ where: { id: existing.id }, data: orderData });
    await tx.orderItem.deleteMany({ where: { orderId: order.id } });
  } else {
    order = await tx.order.create({ data: orderData });
  }

  for (var i = 0; i < menuItems.length; i += 1) {
    var menuItem = menuItems[i];
    var quantity = i === 0 ? 2 : 1;
    await tx.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: menuItem.id,
        quantity: quantity,
        unitPrice: menuItem.basePrice,
        subtotal: menuItem.basePrice * quantity,
        status: 'pending'
      }
    });
  }

  return order;
}

async function upsertReservation(tx, branchId, tableId) {
  var existing = await tx.reservation.findFirst({
    where: { branchId: branchId, guestPhone: DEMO_RESERVATION_PHONE }
  });
  var reservedAt = new Date();
  reservedAt.setHours(19, 30, 0, 0);
  var data = {
    branchId: branchId,
    guestName: 'Nguyen Van A',
    guestPhone: DEMO_RESERVATION_PHONE,
    guestCount: 6,
    tableId: tableId,
    reservedDate: reservedAt,
    reservedTime: reservedAt,
    note: 'Khach VIP, chuan bi ghe tre em',
    status: 'reserved'
  };

  if (existing) {
    return tx.reservation.update({ where: { id: existing.id }, data: data });
  }

  return tx.reservation.create({ data: data });
}

function findByName(items, name) {
  return items.find(function(item) {
    return item.name === name;
  });
}

main()
  .catch(function(error) {
    console.error('[seed] POS table demo failed');
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(function() {
    return prisma.$disconnect();
  });
