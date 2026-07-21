var authMiddleware = require('../middlewares/auth.middleware');
var tableRepository = require('../repositories/table.repository');
var socket = require('../realtime/socket');

var VALID_STATUSES = ['available', 'occupied', 'reserved'];

async function getTableLayout(branchId, query, currentUser) {
  assertValidObjectId(branchId, 'branch id');
  assertEmployeeAccess(currentUser, branchId);

  var filters = normalizeFilters(query || {});
  var branch = await tableRepository.findBranchById(branchId);

  if (!branch) {
    throwHttpError(404, 'Branch not found');
  }

  var areas = await tableRepository.findAreasWithTables(branchId, filters);
  var totalTables = areas.reduce(function(total, area) {
    return total + area.tables.length;
  }, 0);

  return {
    branch_id: branch.id,
    branch_name: branch.name,
    total_tables: totalTables,
    areas: areas.map(function(area) {
      return {
        area_name: area.name,
        tables: area.tables.map(function(table) {
          var result = {
            id: table.id,
            name: table.name,
            capacity: table.capacity,
            status: table.status,
            current_order_id: table.status === 'occupied'
              ? (table.currentOrderId || (table.orders[0] ? table.orders[0].id : null))
              : null,
            guest_name: table.status === 'occupied' && table.orders[0] && table.orders[0].customer 
              ? table.orders[0].customer.fullName 
              : null,
            updated_at: table.updatedAt
          };

          if (table.status === 'reserved') {
            result.reservation_id = table.reservationId || (table.reservations[0] ? table.reservations[0].id : null);
            if (table.reservations[0]) {
              result.guest_name = table.reservations[0].guestName;
              result.reserved_time = table.reservations[0].reservedTime;
            }
          }

          return result;
        })
      };
    })
  };
}

async function updateTableStatus(tableId, payload, currentUser) {
  assertValidObjectId(tableId, 'table id');

  var table = await tableRepository.findTableById(tableId);
  if (!table) {
    throwHttpError(404, 'Table not found');
  }

  assertEmployeeAccess(currentUser, table.area.branchId);

  var status = payload.status.trim().toLowerCase();
  var updateData = await buildStatusUpdateData(table, status, payload);
  var updatedTable = await tableRepository.updateTable(tableId, updateData);

  socket.emitTableStatusUpdated({
    tableId: updatedTable.id,
    newStatus: updatedTable.status,
    branchId: table.area.branchId
  });

  return updatedTable;
}

async function getCurrentOrder(tableId, currentUser) {
  assertValidObjectId(tableId, 'table id');

  var table = await tableRepository.findTableWithBranchById(tableId);
  if (!table) {
    throwHttpError(404, 'Table not found');
  }

  assertEmployeeAccess(currentUser, table.area.branchId);

  var order = await tableRepository.findCurrentOrderByTableId(tableId, table.currentOrderId);
  if (!order) {
    throwHttpError(404, 'No active order found for this table');
  }

  var items = order.orderItems.map(function(item) {
    return {
      id: item.id,
      menu_item_id: item.menuItemId,
      variant_id: item.variantId,
      name: item.variant ? item.menuItem.name + ' - ' + item.variant.name : item.menuItem.name,
      quantity: item.quantity,
      price: item.unitPrice,
      unit_price: item.unitPrice,
      subtotal: item.subtotal,
      note: item.note,
      status: item.status,
      toppings: item.orderItemToppings.map(function(topping) {
        return {
          topping_id: topping.toppingId,
          name: topping.topping.name,
          quantity: topping.quantity,
          extra_price: topping.extraPrice
        };
      })
    };
  });

  return {
    table_id: table.id,
    table_name: table.name,
    order_id: order.id,
    order_code: 'ORD-' + order.id.slice(-4).toUpperCase(),
    guest_count: table.guestCount,
    created_at: order.createdAt,
    total_amount: order.orderItems.reduce(function(total, item) {
      return total + item.subtotal;
    }, 0),
    items: items
  };
}

async function getTableReservation(tableId, currentUser) {
  assertValidObjectId(tableId, 'table id');

  var table = await tableRepository.findTableWithBranchById(tableId);
  if (!table) {
    throwHttpError(404, 'Table not found');
  }

  assertEmployeeAccess(currentUser, table.area.branchId);

  var reservation = await tableRepository.findActiveReservationByTableId(tableId);
  if (!reservation) {
    throwHttpError(404, 'No active reservation found for this table');
  }

  return {
    table_id: table.id,
    table_name: table.name,
    reservation_id: reservation.id,
    guest_name: reservation.guestName,
    guest_phone: reservation.guestPhone,
    guest_count: reservation.guestCount,
    reserved_date: reservation.reservedDate,
    reserved_time: reservation.reservedTime,
    note: reservation.note,
    status: reservation.status
  };
}

async function buildStatusUpdateData(table, status, payload) {
  if (status === 'available') {
    var pendingOrderCount = await tableRepository.hasPendingOrder(table.id);
    if (pendingOrderCount > 0) {
      throwHttpError(400, 'Không thể dọn bàn! Bàn này đang có hóa đơn chưa thanh toán.');
    }

    return { status: 'available', currentOrderId: null, reservationId: null };
  }

  if (status === 'occupied') {
    return assignStatusOptionalFields({ status: 'occupied' }, payload, ['order_id', 'guest_count', 'note']);
  }

  if (payload.reservation_id !== undefined) {
    var reservation = await tableRepository.findReservationById(payload.reservation_id);
    if (!reservation) {
      throwHttpError(404, 'Reservation not found');
    }

    if (reservation.branchId !== table.area.branchId) {
      throwHttpError(400, 'Reservation does not belong to this table branch');
    }
  }

  return assignStatusOptionalFields({ status: 'reserved' }, payload, ['reservation_id', 'guest_count', 'note']);
}

function assignStatusOptionalFields(data, payload, fields) {
  var modelFields = {
    order_id: 'currentOrderId',
    reservation_id: 'reservationId',
    guest_count: 'guestCount',
    note: 'note'
  };

  fields.forEach(function(field) {
    if (payload[field] !== undefined) {
      data[modelFields[field]] = field === 'note' ? payload[field].trim() : payload[field];
    }
  });

  return data;
}

function normalizeFilters(query) {
  var filters = {};

  if (query.area !== undefined) {
    if (typeof query.area !== 'string' || query.area.trim() === '') {
      throwHttpError(400, 'area must be a non-empty string');
    }

    filters.area = query.area.trim();
  }

  if (query.status !== undefined) {
    if (typeof query.status !== 'string' || VALID_STATUSES.indexOf(query.status.trim().toLowerCase()) === -1) {
      throwHttpError(400, 'status must be one of: ' + VALID_STATUSES.join(', '));
    }

    filters.status = query.status.trim().toLowerCase();
  }

  return filters;
}

function assertEmployeeAccess(currentUser, branchId) {
  if (!currentUser || currentUser.type !== 'employee') {
    throwHttpError(403, 'Staff, Cashier, Chain Admin or Owner role is required');
  }

  if (authMiddleware.isOwner(currentUser) || authMiddleware.isChainAdmin(currentUser)) {
    return;
  }

  if (String(currentUser.branchId) !== String(branchId)) {
    throwHttpError(403, 'You can only view table layout for your own branch');
  }
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
  getTableLayout: getTableLayout,
  getCurrentOrder: getCurrentOrder,
  getTableReservation: getTableReservation,
  updateTableStatus: updateTableStatus
};
