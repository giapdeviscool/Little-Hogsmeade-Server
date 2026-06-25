var authMiddleware = require('../middlewares/auth.middleware');
var prisma = require('../lib/prisma');
var reservationRepository = require('../repositories/reservation.repository');
var socket = require('../realtime/socket');
const orderRepository = require('../repositories/order.repository');

var ACTIVE_RESERVATION_STATUSES = ['pending', 'confirmed', 'reserved'];

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
        reservationId: null,
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

async function markReservationNoShow(reservationId, currentUser) {
  var reservation = await getAuthorizedReservation(reservationId, currentUser);
  assertActiveReservation(reservation);

  var result = await prisma.$transaction(async function (tx) {
    var updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: 'no_show' }
    });
    var releasedTable = null;

    if (reservation.tableId) {
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
    throwHttpError(400, 'Only pending, confirmed, or reserved reservations can be updated');
  }
}

function assertEmployeeAccess(currentUser, branchId) {
  if (!currentUser || currentUser.type !== 'employee') {
    throwHttpError(403, 'Staff, Cashier, Chain Admin or Owner role is required');
  }

  if (!authMiddleware.isOwner(currentUser) && currentUser.branchId !== branchId) {
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
  checkInReservation: checkInReservation,
  markReservationNoShow: markReservationNoShow
};
