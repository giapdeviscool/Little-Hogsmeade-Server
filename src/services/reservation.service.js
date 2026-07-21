var authMiddleware = require('../middlewares/auth.middleware');
var prisma = require('../lib/prisma');
var reservationRepository = require('../repositories/reservation.repository');
var socket = require('../realtime/socket');
const orderRepository = require('../repositories/order.repository');

var ACTIVE_RESERVATION_STATUSES = ['pending', 'confirmed', 'reserved', 'checked_in'];

async function getReservations(currentUser, queryBranchId) {
  if (!currentUser || currentUser.type !== 'employee') {
    throwHttpError(403, 'Staff, Cashier, Chain Admin or Owner role is required');
  }

  var filter = {};

  if (authMiddleware.isOwner(currentUser) || authMiddleware.isChainAdmin(currentUser)) {
    if (queryBranchId) {
      filter.branchId = queryBranchId;
    }
  } else {
    filter.branchId = currentUser.branchId;
  }

  var reservations = await prisma.reservation.findMany({
    where: filter,
    orderBy: {
      reservedDate: 'desc'
    },
    include: {
      table: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  return reservations;
}

async function checkInReservation(reservationId, payload, currentUser) {
  var reservation = await getAuthorizedReservation(reservationId, currentUser);
  assertActiveReservation(reservation);

  if (!reservation.table) {
    throwHttpError(400, 'Reservation does not have an assigned table');
  }

  var guestCount = payload.actual_guest_count === undefined
    ? reservation.guestCount
    : payload.actual_guest_count;
  // console.log("reservation : ", reservation)


  var result = await prisma.$transaction(async function (tx) {
    var customer = await findOrCreateReservationCustomer(tx, reservation.guestPhone, reservation.guestName);

    var updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        customerId: customer.id,
        status: 'checked_in'
      }
    });
    var updatedTable = await tx.table.update({
      where: { id: reservation.tableId },
      data: {
        status: 'occupied',
        currentOrderId: null,
        guestCount: guestCount,
        note: reservation.note
      }
    });

    return { reservation: updatedReservation, table: updatedTable };
  });

  socket.emitTableStatusUpdated({
    tableId: result.table.id,
    newStatus: result.table.status,
    branchId: reservation.branchId
  });

  return result;
}

async function updateReservationStatus(reservationId, status, currentUser) {
  var reservation = await getAuthorizedReservation(reservationId, currentUser);
  assertActiveReservation(reservation);

  var result = await prisma.$transaction(async function (tx) {
    var updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: status }
    });
    var releasedTable = null;

    if (reservation.tableId && (status === 'no_show' || status === 'cancelled' || status === 'completed')) {
      var currentTable = await tx.table.findUnique({
        where: { id: reservation.tableId },
        select: { id: true, reservationId: true }
      });

      if (currentTable && currentTable.reservationId === reservation.id) {
        releasedTable = await tx.table.update({
          where: { id: currentTable.id },
          data: {
            status: 'available',
            reservationId: null,
            guestCount: null,
            note: null
          }
        });
      }
    }

    return { reservation: updatedReservation, table: releasedTable };
  });

  if (result.table) {
    socket.emitTableStatusUpdated({
      tableId: result.table.id,
      newStatus: result.table.status,
      branchId: reservation.branchId
    });
  }

  return result;
}

async function assignTableToReservation(reservationId, tableId, currentUser) {
  var reservation = await getAuthorizedReservation(reservationId, currentUser);
  assertActiveReservation(reservation);

  assertValidObjectId(tableId, 'table id');
  var table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { id: true, status: true, area: { select: { branchId: true } } }
  });

  if (!table) {
    throwHttpError(404, 'Table not found');
  }

  var tableBranchId = table.branchId || (table.area && table.area.branchId);
  if (String(tableBranchId) !== String(reservation.branchId)) {
    throwHttpError(400, 'Table does not belong to the same branch as reservation');
  }

  var result = await prisma.$transaction(async function (tx) {
    var updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        tableId: table.id,
        status: 'confirmed'
      }
    });

    var updatedTable = await tx.table.update({
      where: { id: table.id },
      data: {
        reservationId: reservation.id,
        status: table.status === 'available' ? 'reserved' : table.status
      }
    });

    return { reservation: updatedReservation, table: updatedTable };
  });

  if (result.table) {
    socket.emitTableStatusUpdated({
      tableId: result.table.id,
      newStatus: result.table.status,
      branchId: reservation.branchId
    });
  }

  return result;
}

async function getAuthorizedReservation(reservationId, currentUser) {
  assertValidObjectId(reservationId, 'reservation id');

  var reservation = await reservationRepository.findWithTableById(reservationId);
  if (!reservation) {
    throwHttpError(404, 'Reservation not found');
  }

  assertEmployeeAccess(currentUser, reservation.branchId);
  return reservation;
}

function assertActiveReservation(reservation) {
  if (ACTIVE_RESERVATION_STATUSES.indexOf(String(reservation.status).toLowerCase()) === -1) {
    throwHttpError(400, 'Only pending, confirmed, reserved, or checked_in reservations can be updated');
  }
}

function assertEmployeeAccess(currentUser, branchId) {
  if (!currentUser || currentUser.type !== 'employee') {
    throwHttpError(403, 'Staff, Cashier, Chain Admin or Owner role is required');
  }

  if (authMiddleware.isOwner(currentUser) || authMiddleware.isChainAdmin(currentUser)) {
    return;
  }

  if (String(currentUser.branchId) !== String(branchId)) {
    throwHttpError(403, 'You can only manage reservations for your own branch');
  }
}

async function findOrCreateReservationCustomer(tx, phone, fullName) {
  var normalizedPhone = normalizeRequiredString(phone, 'guestPhone');
  var normalizedName = normalizeRequiredString(fullName, 'guestName');

  var customer = await orderRepository.findCusomterByPhone(normalizedPhone, tx);
  if (customer) {
    return customer;
  }

  return orderRepository.createCustomer({
    phone: normalizedPhone,
    fullName: normalizedName,
    source: 'online-reservation'
  }, tx);
}

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throwHttpError(400, fieldName + ' is required');
  }

  return value.trim();
}

function assertValidObjectId(value, fieldName) {
  if (!value || typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throwHttpError(400, 'Invalid ' + fieldName + ': must be a 24-character ObjectId');
  }
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  getReservations: getReservations,
  checkInReservation: checkInReservation,
  updateReservationStatus: updateReservationStatus,
  assignTableToReservation: assignTableToReservation
};
