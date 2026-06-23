var prisma = require('../lib/prisma');

function findBranchById(id) {
  return prisma.branch.findUnique({
    where: { id: id },
    select: {
      id: true,
      name: true
    }
  });
}

function findAreasWithTables(branchId, filters) {
  var tableWhere = {};

  if (filters.status) {
    tableWhere.status = filters.status;
  }

  return prisma.area.findMany({
    where: {
      branchId: branchId,
      ...(filters.area ? { name: filters.area } : {})
    },
    select: {
      id: true,
      name: true,
      tables: {
        where: tableWhere,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          capacity: true,
          status: true,
          currentOrderId: true,
          reservationId: true,
          updatedAt: true,
          orders: {
            where: {
              status: { in: ['pending', 'confirmed', 'preparing', 'in_progress', 'serving', 'open'] }
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true }
          },
          reservations: {
            where: {
              status: { in: ['pending', 'confirmed', 'reserved'] }
            },
            orderBy: { reservedDate: 'asc' },
            take: 1,
            select: { id: true }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });
}

function findTableById(id) {
  return prisma.table.findUnique({
    where: { id: id },
    include: {
      area: {
        select: { branchId: true }
      }
    }
  });
}

function findTableWithBranchById(id) {
  return prisma.table.findUnique({
    where: { id: id },
    select: {
      id: true,
      name: true,
      guestCount: true,
      area: {
        select: { branchId: true }
      }
    }
  });
}

function findCurrentOrderByTableId(tableId) {
  return prisma.order.findFirst({
    where: {
      tableId: tableId,
      status: { in: ['PENDING', 'pending'] }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      orderItems: {
        select: {
          quantity: true,
          unitPrice: true,
          subtotal: true,
          menuItem: {
            select: { name: true }
          },
          variant: {
            select: { name: true }
          }
        }
      }
    }
  });
}

function findActiveReservationByTableId(tableId) {
  return prisma.reservation.findFirst({
    where: {
      tableId: tableId,
      status: { in: ['pending', 'confirmed', 'reserved', 'PENDING', 'CONFIRMED', 'RESERVED'] }
    },
    orderBy: { reservedDate: 'asc' }
  });
}

function hasPendingOrder(tableId) {
  return prisma.order.count({
    where: {
      tableId: tableId,
      status: { in: ['PENDING', 'pending'] }
    }
  });
}

function findReservationById(id) {
  return prisma.reservation.findUnique({
    where: { id: id },
    select: {
      id: true,
      branchId: true
    }
  });
}

function updateTable(id, data) {
  return prisma.table.update({
    where: { id: id },
    data: data
  });
}

module.exports = {
  findBranchById: findBranchById,
  findAreasWithTables: findAreasWithTables,
  findTableById: findTableById,
  findTableWithBranchById: findTableWithBranchById,
  findCurrentOrderByTableId: findCurrentOrderByTableId,
  findActiveReservationByTableId: findActiveReservationByTableId,
  hasPendingOrder: hasPendingOrder,
  findReservationById: findReservationById,
  updateTable: updateTable
};
