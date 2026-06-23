var orderRepository = require('../repositories/order.repository');
var prisma = require('../lib/prisma');

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
  var orderStatus = payload.status || 'paid';
  var paymentMethod = payload.paymentMethod;
  var discountAmount = normalizeNumber(payload.discountAmount);
  var taxAmount = normalizeNumber(payload.taxAmount);
  var items = Array.isArray(payload.items) ? payload.items : [];

  return prisma.$transaction(async function(tx) {
    var order = await orderRepository.createOrder({
      branchId: branchId,
      employeeId: employeeId,
      customerId: customerId,
      status: orderStatus,
      orderType: payload.orderType || 'dine-in',
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
      status: paymentStatus
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

    return {
      order: order,
      items: createdItems,
      invoice: invoice,
      payment: payment,
      loyalty: loyaltyResult
    };
  });
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

module.exports = {
  createOrder: createOrder,
  updateOrderStatus: updateOrderStatus,
  deleteOrder: deleteOrder
};
