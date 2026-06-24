var orderRepository = require('../repositories/order.repository');
var prisma = require('../lib/prisma');
var authMiddleware = require('../middlewares/auth.middleware');
var socket = require('../realtime/socket');

var OPEN_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'in_progress', 'serving', 'open'];

function assertValidId(id) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throwHttpError(400, 'Invalid order id');
  }
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function normalizeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function calculateOrderTotals(items, discountAmount, taxAmount) {
  var itemSubtotal = 0;
  var toppingSubtotal = 0;

  for (var i = 0; i < items.length; i += 1) {
    var item = items[i];
    var itemLine = item.subtotal !== undefined
      ? item.subtotal
      : item.unitPrice * item.quantity;

    itemSubtotal += itemLine;

    if (Array.isArray(item.toppings)) {
      for (var j = 0; j < item.toppings.length; j += 1) {
        var topping = item.toppings[j];
        toppingSubtotal += topping.extraPrice * topping.quantity;
      }
    }
  }

  var subtotal = itemSubtotal + toppingSubtotal;
  var totalAmount = subtotal - discountAmount + taxAmount;

  if (totalAmount < 0) {
    totalAmount = 0;
  }

  return {
    subtotal: subtotal,
    discountAmount: discountAmount,
    taxAmount: taxAmount,
    totalAmount: totalAmount
  };
}

async function createOrder(branchId, employeeId, payload) {
  if (!branchId || typeof branchId !== 'string') {
    throwHttpError(403, 'BranchId must be provided by authentication token');
  }

  if (!employeeId || typeof employeeId !== 'string') {
    throwHttpError(403, 'EmployeeId must be provided by authentication token');
  }

  if (!payload || typeof payload !== 'object') {
    throwHttpError(400, 'Order payload is required');
  }

  var customerId = payload.customerId || null;
  var tableId = payload.tableId || null;
  var orderStatus = payload.status || (tableId ? 'pending' : 'paid');
  var paymentMethod = payload.paymentMethod;
  var discountAmount = normalizeNumber(payload.discountAmount);
  var taxAmount = normalizeNumber(payload.taxAmount);
  var items = Array.isArray(payload.items) ? payload.items : [];
  var cashierShiftId = payload.cashierShiftId || null;

  var result = await prisma.$transaction(async function(tx) {
    var table = null;

    if (tableId) {
      table = await tx.table.findUnique({
        where: { id: tableId },
        include: { area: { select: { branchId: true } } }
      });

      if (!table) {
        throwHttpError(404, 'Table not found');
      }

      if (table.area.branchId !== branchId) {
        throwHttpError(400, 'Table does not belong to the order branch');
      }

      if (normalizeOrderType(payload.orderType || 'dine-in') !== 'dine-in') {
        throwHttpError(400, 'Only dine-in orders can be assigned to a table');
      }

      if (OPEN_ORDER_STATUSES.indexOf(normalizeStatus(orderStatus)) === -1) {
        throwHttpError(400, 'An order assigned to a table must start with an open status');
      }

      var tableStatus = normalizeStatus(table.status);
      var isAvailableTable = tableStatus === 'available';
      var isCheckedInTableWithoutOrder = tableStatus === 'occupied' && !table.currentOrderId;

      if ((!isAvailableTable && !isCheckedInTableWithoutOrder) || table.currentOrderId || table.reservationId) {
        throwHttpError(409, 'Table is not available');
      }
    }

    var order = await orderRepository.createOrder({
      branchId: branchId,
      employeeId: employeeId,
      customerId: customerId,
      tableId: tableId,
      status: orderStatus,
      orderType: payload.orderType || 'dine-in',
      cashierShiftId: cashierShiftId,
      createdAt: new Date(),
    }, tx);

    var createdItems = [];

    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var itemSubtotal = item.subtotal !== undefined
        ? item.subtotal
        : item.unitPrice * item.quantity;

      var orderItem = await orderRepository.createOrderItem({
        orderId: order.id,
        menuItemId: item.menuItemId,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal
      }, tx);

      createdItems.push(orderItem);

      if (Array.isArray(item.toppings)) {
        for (var j = 0; j < item.toppings.length; j += 1) {
          var topping = item.toppings[j];

          await orderRepository.createOrderItemTopping({
            orderItemId: orderItem.id,
            toppingId: topping.toppingId,
            quantity: topping.quantity,
            extraPrice: topping.extraPrice
          }, tx);
        }
      }
    }

    var totals = calculateOrderTotals(items, discountAmount, taxAmount);

    var invoice = await orderRepository.createInvoice({
      orderId: order.id,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      pointsEarned: 0,
      status: orderStatus
    }, tx);

    var paymentStatus = orderStatus === 'paid' ? 'completed' : 'pending';

    var payment = await orderRepository.createPayment({
      invoiceId: invoice.id,
      method: paymentMethod,
      amount: totals.totalAmount,
      status: paymentStatus,
      paidAt: paymentStatus === 'completed' ? new Date() : null
    }, tx);

    var loyaltyResult = null;

    if (orderStatus === 'paid' && customerId) {
      var loyaltyConfig = await orderRepository.findLoyaltyConfigByBranch(branchId, tx);

      if (loyaltyConfig && loyaltyConfig.spendPerPoint > 0) {
        var pointsEarned = totals.totalAmount / loyaltyConfig.spendPerPoint;

        invoice = await orderRepository.updateInvoice(invoice.id, {
          pointsEarned: pointsEarned
        }, tx);

        var membership = await orderRepository.findCustomerMembershipByCustomerId(customerId, tx);

        if (!membership) {
          membership = await orderRepository.createCustomerMembership({
            customerId: customerId,
            totalPoints: 0,
            totalSpent: 0
          }, tx);
        }

        var updatedMembership = await orderRepository.updateCustomerMembership(membership.id, {
          totalPoints: membership.totalPoints + pointsEarned,
          totalSpent: membership.totalSpent + totals.totalAmount
        }, tx);

        await orderRepository.createPointTransaction({
          customerMembershipId: updatedMembership.id,
          orderId: order.id,
          type: 'earn',
          points: pointsEarned,
          note: 'Loyalty points earned for paid order'
        }, tx);

      loyaltyResult = {
          pointsEarned: pointsEarned,
          membershipId: updatedMembership.id
        };
      }
    }

    var occupiedTable = null;

    if (table) {
      occupiedTable = await tx.table.update({
        where: { id: table.id },
        data: {
          status: 'occupied',
          currentOrderId: order.id,
          reservationId: null
        }
      });
    }

    return {
      order: order,
      items: createdItems,
      invoice: invoice,
      payment: payment,
      loyalty: loyaltyResult,
      table: occupiedTable
    };
  });

  if (result.table) {
    socket.emitTableStatusUpdated({
      tableId: result.table.id,
      newStatus: result.table.status,
      branchId: branchId
    });
  }

  return result;
}

async function updateOrderStatus(id, status) {
  assertValidId(id);

  if (typeof status !== 'string' || status.trim() === '') {
    throwHttpError(400, 'Status is required');
  }

  return prisma.$transaction(async function(tx) {
    var order = await orderRepository.findOrderById(id, tx);
    if (!order) {
      throwHttpError(404, 'Order not found');
    }

    var updatedOrder = await orderRepository.updateOrderStatus(id, status, tx);
    var invoice = await orderRepository.findInvoiceByOrderId(id, tx);

    if (invoice) {
      await orderRepository.updateInvoiceStatusByOrderId(id, status, tx);

      if (status === 'cancelled' || status === 'refunded') {
        var paymentStatus = status === 'cancelled' ? 'failed' : 'refunded';
        await orderRepository.updatePaymentStatusByInvoiceId(invoice.id, paymentStatus, tx);

        if (invoice.pointsEarned > 0 && order.customerId) {
          var membership = await orderRepository.findCustomerMembershipByCustomerId(order.customerId, tx);
          if (membership) {
            var adjustedPoints = Math.min(membership.totalPoints, invoice.pointsEarned);
            var adjustedSpent = Math.min(membership.totalSpent, invoice.totalAmount);

            await orderRepository.updateCustomerMembership(membership.id, {
              totalPoints: membership.totalPoints - adjustedPoints,
              totalSpent: membership.totalSpent - adjustedSpent
            }, tx);

            await orderRepository.createPointTransaction({
              customerMembershipId: membership.id,
              orderId: id,
              type: 'adjust',
              points: -Math.abs(invoice.pointsEarned),
              note: 'Loyalty rollback for cancelled or refunded order'
            }, tx);
          }
        }
      }
    }

    return {
      order: updatedOrder,
      invoice: invoice || null
    };
  });
}

async function addOrderItems(orderId, items, currentUser) {
  assertValidId(orderId);

  var result = await prisma.$transaction(async function(tx) {
    var order = await orderRepository.findOrderById(orderId, tx);

    if (!order) {
      throwHttpError(404, 'Order not found');
    }

    assertEmployeeAccess(currentUser, order.branchId);

    if (OPEN_ORDER_STATUSES.indexOf(normalizeStatus(order.status)) === -1) {
      throwHttpError(409, 'Only open orders can add items');
    }

    var createdItems = [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var itemSubtotal = item.subtotal !== undefined
        ? item.subtotal
        : item.unitPrice * item.quantity;
      var orderItem = await orderRepository.createOrderItem({
        orderId: order.id,
        menuItemId: item.menuItemId,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal
      }, tx);

      createdItems.push(orderItem);

      if (Array.isArray(item.toppings)) {
        for (var j = 0; j < item.toppings.length; j += 1) {
          var topping = item.toppings[j];
          await orderRepository.createOrderItemTopping({
            orderItemId: orderItem.id,
            toppingId: topping.toppingId,
            quantity: topping.quantity,
            extraPrice: topping.extraPrice
          }, tx);
        }
      }
    }

    var invoice = await orderRepository.findInvoiceByOrderId(order.id, tx);
    var updatedInvoice = null;

    if (invoice) {
      var addedTotals = calculateOrderTotals(items, 0, 0);
      var newSubtotal = invoice.subtotal + addedTotals.subtotal;
      var newTotalAmount = Math.max(0, newSubtotal - invoice.discountAmount + invoice.taxAmount);

      updatedInvoice = await orderRepository.updateInvoice(invoice.id, {
        subtotal: newSubtotal,
        totalAmount: newTotalAmount
      }, tx);
      await orderRepository.updatePaymentAmountByInvoiceId(invoice.id, newTotalAmount, tx);
    }

    return {
      order: order,
      items: createdItems,
      invoice: updatedInvoice
    };
  });

  return {
    order_id: result.order.id,
    added_items: result.items,
    invoice: result.invoice
  };
}

async function changeOrderTable(orderId, targetTableId, currentUser) {
  assertValidId(orderId);
  assertValidId(targetTableId);

  var result = await prisma.$transaction(async function(tx) {
    var order = await tx.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throwHttpError(404, 'Order not found');
    }

    assertEmployeeAccess(currentUser, order.branchId);

    if (normalizeOrderType(order.orderType) !== 'dine-in') {
      throwHttpError(400, 'Only dine-in orders can change tables');
    }

    if (OPEN_ORDER_STATUSES.indexOf(normalizeStatus(order.status)) === -1) {
      throwHttpError(409, 'Only open orders can change tables');
    }

    if (!order.tableId) {
      throwHttpError(400, 'Order does not have a current table');
    }

    if (order.tableId === targetTableId) {
      throwHttpError(400, 'Target table is the current table');
    }

    var sourceTable = await tx.table.findUnique({
      where: { id: order.tableId },
      include: { area: { select: { branchId: true } } }
    });
    var targetTable = await tx.table.findUnique({
      where: { id: targetTableId },
      include: { area: { select: { branchId: true } } }
    });

    if (!sourceTable) {
      throwHttpError(409, 'Order current table no longer exists');
    }

    if (!targetTable) {
      throwHttpError(404, 'Target table not found');
    }

    if (sourceTable.area.branchId !== order.branchId || targetTable.area.branchId !== order.branchId) {
      throwHttpError(400, 'Tables must belong to the order branch');
    }

    if (sourceTable.currentOrderId && sourceTable.currentOrderId !== order.id) {
      throwHttpError(409, 'Order is no longer the active order for its current table');
    }

    if (normalizeStatus(targetTable.status) !== 'available' || targetTable.currentOrderId || targetTable.reservationId) {
      throwHttpError(409, 'Target table is not available');
    }

    var activeOrderAtTarget = await tx.order.findFirst({
      where: {
        tableId: targetTable.id,
        status: { in: OPEN_ORDER_STATUSES.concat(OPEN_ORDER_STATUSES.map(function(status) { return status.toUpperCase(); })) }
      },
      select: { id: true }
    });

    if (activeOrderAtTarget) {
      throwHttpError(409, 'Target table already has an open order');
    }

    var updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { tableId: targetTable.id }
    });
    var releasedTable = await tx.table.update({
      where: { id: sourceTable.id },
      data: {
        status: 'available',
        currentOrderId: null,
        guestCount: null,
        note: null
      }
    });
    var occupiedTable = await tx.table.update({
      where: { id: targetTable.id },
      data: {
        status: 'occupied',
        currentOrderId: order.id,
        reservationId: null,
        guestCount: sourceTable.guestCount,
        note: sourceTable.note
      }
    });

    return {
      order: updatedOrder,
      sourceTable: releasedTable,
      targetTable: occupiedTable
    };
  });

  socket.emitTableStatusUpdated({
    tableId: result.sourceTable.id,
    newStatus: result.sourceTable.status,
    branchId: result.order.branchId
  });
  socket.emitTableStatusUpdated({
    tableId: result.targetTable.id,
    newStatus: result.targetTable.status,
    branchId: result.order.branchId
  });

  return {
    order_id: result.order.id,
    from_table: formatTable(result.sourceTable),
    to_table: formatTable(result.targetTable)
  };
}

async function deleteOrder(id) {
  assertValidId(id);

  return prisma.$transaction(async function(tx) {
    var order = await orderRepository.findOrderById(id, tx);
    if (!order) {
      throwHttpError(404, 'Order not found');
    }

    var invoice = await orderRepository.findInvoiceByOrderId(id, tx);

    if (invoice) {
      await orderRepository.deletePointTransactionsByOrderId(id, tx);
      await orderRepository.deletePaymentsByInvoiceId(invoice.id, tx);
      await orderRepository.deleteInvoiceByOrderId(id, tx);
    }

    var orderItems = await orderRepository.findOrderItemsByOrderId(id, tx);
    var orderItemIds = orderItems.map(function(item) {
      return item.id;
    });

    if (orderItemIds.length > 0) {
      await orderRepository.deleteOrderItemToppingsByOrderItemIds(orderItemIds, tx);
    }

    await orderRepository.deleteOrderItemsByOrderId(id, tx);
    await orderRepository.deleteOrderById(id, tx);

    return {
      deleted: true
    };
  });
}

function formatTable(table) {
  return {
    id: table.id,
    name: table.name,
    status: table.status,
    current_order_id: table.currentOrderId
  };
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeOrderType(value) {
  return normalizeStatus(value).replace(/[_\s]+/g, '-');
}

function assertEmployeeAccess(currentUser, branchId) {
  if (!currentUser || currentUser.type !== 'employee') {
    throwHttpError(403, 'Staff, Cashier, Chain Admin or Owner role is required');
  }

  if (!authMiddleware.isOwner(currentUser) && currentUser.branchId !== branchId) {
    throwHttpError(403, 'You can only manage orders for your own branch');
  }
}

module.exports = {
  createOrder: createOrder,
  addOrderItems: addOrderItems,
  updateOrderStatus: updateOrderStatus,
  changeOrderTable: changeOrderTable,
  deleteOrder: deleteOrder
};
