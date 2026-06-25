var prisma = require('../lib/prisma');

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function assertValidObjectId(id, name) {
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
    throwHttpError(400, 'Invalid ' + (name || 'id'));
  }
}

function normalizeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function calculateLoyaltyPoints(loyaltyConfig, totalAmount, discountAmount) {
  if (!loyaltyConfig || !loyaltyConfig.isActive) {
    return null;
  }

  var spendPerPoint = loyaltyConfig.spendPerPoint;

  if (!spendPerPoint || spendPerPoint <= 0) {
    if (loyaltyConfig.spendAmount > 0 && loyaltyConfig.earnPoint > 0) {
      spendPerPoint = loyaltyConfig.spendAmount / loyaltyConfig.earnPoint;
    } else {
      return null;
    }
  }

  var hasDiscount = normalizeNumber(discountAmount) > 0;

  if (hasDiscount && !loyaltyConfig.allowVoucherEarning) {
    return null;
  }

  var pointsEarned = totalAmount / spendPerPoint;

  if (!loyaltyConfig.allowFractionalPoints) {
    pointsEarned = Math.floor(pointsEarned);
  }

  if (pointsEarned <= 0) {
    return null;
  }

  return pointsEarned;
}

async function createDeliveryOrder(payload, user) {
  if (!payload || typeof payload !== 'object') {
    throwHttpError(400, 'Payload is required');
  }

  // 1. Resolve and validate branch ID
  var branchId = payload.branch_id || (user && user.branchId);
  if (!branchId) {
    throwHttpError(400, 'branch_id is required');
  }
  assertValidObjectId(branchId, 'branch_id');

  // Verify branch exists
  var branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    throwHttpError(404, 'Branch not found');
  }

  // 2. Validate employee ID
  var employeeId = user && user.id;
  if (!employeeId) {
    throwHttpError(401, 'Authentication required');
  }
  assertValidObjectId(employeeId, 'employee_id');

  // 3. Resolve customer ID (optional)
  var customerId = payload.customer_id || null;
  if (customerId) {
    assertValidObjectId(customerId, 'customer_id');
    var customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throwHttpError(404, 'Customer not found');
    }
  }

  // 4. Validate order type
  if (payload.order_type !== 'delivery') {
    throwHttpError(400, 'order_type must be "delivery"');
  }

  // 5. Validate items
  var items = payload.items;
  if (!Array.isArray(items) || items.length === 0) {
    throwHttpError(400, 'items must be a non-empty array');
  }

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item.menu_item_id) {
      throwHttpError(400, 'Each item must have a menu_item_id');
    }
    assertValidObjectId(item.menu_item_id, 'menu_item_id');
    if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throwHttpError(400, 'Item quantity must be a positive integer');
    }
    if (item.unit_price === undefined || typeof item.unit_price !== 'number' || item.unit_price < 0) {
      throwHttpError(400, 'Item unit_price must be a non-negative number');
    }
  }

  // 6. Validate delivery_info
  var deliveryInfo = payload.delivery_info;
  if (!deliveryInfo || typeof deliveryInfo !== 'object') {
    throwHttpError(400, 'delivery_info is required');
  }
  if (!deliveryInfo.customer_name || typeof deliveryInfo.customer_name !== 'string' || deliveryInfo.customer_name.trim() === '') {
    throwHttpError(400, 'delivery_info.customer_name is required');
  }
  if (!deliveryInfo.customer_phone || typeof deliveryInfo.customer_phone !== 'string' || deliveryInfo.customer_phone.trim() === '') {
    throwHttpError(400, 'delivery_info.customer_phone is required');
  }
  if (!deliveryInfo.delivery_address || typeof deliveryInfo.delivery_address !== 'string' || deliveryInfo.delivery_address.trim() === '') {
    throwHttpError(400, 'delivery_info.delivery_address is required');
  }

  var deliveryFee = normalizeNumber(deliveryInfo.delivery_fee);
  var estimatedTime = deliveryInfo.estimated_time ? new Date(deliveryInfo.estimated_time) : null;
  var note = payload.note || null;

  // 7. DB Transaction
  return prisma.$transaction(async function(tx) {
    // A. Create Order
    var order = await tx.order.create({
      data: {
        branchId: branchId,
        customerId: customerId,
        employeeId: employeeId,
        orderType: 'delivery',
        status: 'pending',
        note: note,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // B. Create Order Items & calculate subtotal
    var subtotal = 0;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var itemSubtotal = item.unit_price * item.quantity;
      subtotal += itemSubtotal;

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId: item.menu_item_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: itemSubtotal,
          status: 'pending'
        }
      });
    }

    // C. Create Invoice
    var totalAmount = subtotal + deliveryFee;
    var invoice = await tx.invoice.create({
      data: {
        orderId: order.id,
        subtotal: subtotal,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: totalAmount,
        pointsEarned: 0,
        pointsUsed: 0,
        status: 'unpaid',
        createdAt: new Date()
      }
    });

    // D. Create Payment
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        method: 'cash',
        amount: totalAmount,
        status: 'pending'
      }
    });

    // E. Create DeliveryOrder
    var deliveryOrder = await tx.deliveryOrder.create({
      data: {
        orderId: order.id,
        customerName: deliveryInfo.customer_name.trim(),
        customerPhone: deliveryInfo.customer_phone.trim(),
        deliveryAddress: deliveryInfo.delivery_address.trim(),
        deliveryFee: deliveryFee,
        estimatedTime: estimatedTime,
        status: 'pending',
        note: note
      }
    });

    return {
      order_id: order.id,
      delivery_order_id: deliveryOrder.id
    };
  });
}

async function getDeliveryOrders(query, user) {
  var statuses = [];
  if (query && query.status) {
    statuses = query.status.split(',').map(function(s) {
      return s.trim();
    }).filter(Boolean);
  }

  var where = {};
  if (statuses.length > 0) {
    where.status = { in: statuses };
  }

  // Fetch from database
  var deliveryOrders = await prisma.deliveryOrder.findMany({
    where: where,
    include: {
      deliveryEmployee: {
        select: {
          id: true,
          fullName: true
        }
      },
      order: {
        include: {
          invoices: true
        }
      }
    }
  });

  // Sort by order's createdAt desc in JavaScript to ensure MongoDB compatibility
  deliveryOrders.sort(function(a, b) {
    var dateA = a.order ? new Date(a.order.createdAt) : 0;
    var dateB = b.order ? new Date(b.order.createdAt) : 0;
    return dateB - dateA;
  });

  // Map to the requested response format
  return deliveryOrders.map(function(doItem) {
    var invoice = doItem.order && doItem.order.invoices && doItem.order.invoices[0];
    var isPaid = invoice ? invoice.status === 'paid' : false;
    var totalAmount = invoice ? invoice.totalAmount : 0;

    return {
      delivery_id: doItem.id,
      order_id: doItem.orderId,
      status: doItem.status,
      customer_name: doItem.customerName,
      customer_phone: doItem.customerPhone,
      delivery_address: doItem.deliveryAddress,
      total_amount_to_collect: isPaid ? 0 : totalAmount,
      delivery_employee: doItem.deliveryEmployee ? {
        id: doItem.deliveryEmployee.id,
        name: doItem.deliveryEmployee.fullName
      } : null,
      created_at: doItem.order ? doItem.order.createdAt : null
    };
  });
}

async function assignShipper(deliveryId, employeeId) {
  assertValidObjectId(deliveryId, 'deliveryId');
  assertValidObjectId(employeeId, 'delivery_employee_id');

  // Verify delivery order exists
  var deliveryOrder = await prisma.deliveryOrder.findUnique({ where: { id: deliveryId } });
  if (!deliveryOrder) {
    throwHttpError(404, 'Delivery order not found');
  }

  if (deliveryOrder.status === 'delivered' || deliveryOrder.status === 'failed') {
    throwHttpError(400, 'Cannot assign shipper to a completed delivery order');
  }

  // Verify employee exists
  var employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throwHttpError(404, 'Shipper employee not found');
  }

  // Update
  await prisma.deliveryOrder.update({
    where: { id: deliveryId },
    data: {
      deliveryEmployeeId: employeeId,
      status: 'assigned'
    }
  });

  return { success: true, message: 'Shipper assigned successfully' };
}

async function updateDeliveryStatus(deliveryId, payload) {
  assertValidObjectId(deliveryId, 'deliveryId');

  if (!payload || !payload.status) {
    throwHttpError(400, 'Status is required');
  }

  var status = payload.status;
  if (status === 'on-the-way') {
    status = 'on_the_way';
  }

  var validStatuses = ['pending', 'on_the_way', 'delivered', 'failed'];
  if (validStatuses.indexOf(status) === -1) {
    throwHttpError(400, 'Invalid status. Must be one of: ' + validStatuses.join(', '));
  }

  var deliveryOrder = await prisma.deliveryOrder.findUnique({
    where: { id: deliveryId },
    include: {
      order: {
        include: {
          invoices: true
        }
      }
    }
  });

  if (!deliveryOrder) {
    throwHttpError(404, 'Delivery order not found');
  }

  if (deliveryOrder.status === 'delivered' || deliveryOrder.status === 'failed') {
    throwHttpError(400, 'Cannot change status of a completed delivery order');
  }

  var note = payload.note || deliveryOrder.note || null;

  return prisma.$transaction(async function(tx) {
    var updateData = {
      status: status,
      note: note
    };

    if (status === 'pending') {
      updateData.deliveryEmployeeId = null;
    }

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    // 1. Update delivery order status
    var updatedDeliveryOrder = await tx.deliveryOrder.update({
      where: { id: deliveryId },
      data: updateData
    });

    // 2. If status is 'delivered', perform completion logic
    if (payload.status === 'delivered') {
      var orderId = deliveryOrder.orderId;

      // Update Order to completed
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'completed', updatedAt: new Date() }
      });

      // Find the invoice and update invoice & payment
      var invoice = await tx.invoice.findFirst({
        where: { orderId: orderId }
      });

      if (invoice && invoice.status !== 'paid') {
        // Update Invoice status to paid
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'paid' }
        });

        // Update Payment status to completed
        await tx.payment.updateMany({
          where: { invoiceId: invoice.id },
          data: { status: 'completed' }
        });

        // Loyalty points calculation
        if (deliveryOrder.order.customerId) {
          var customerId = deliveryOrder.order.customerId;
          var branchId = deliveryOrder.order.branchId;

          // Find loyalty config
          var loyaltyConfig = await tx.loyaltyConfig.findFirst({
            where: {
              branchId: branchId,
              isActive: true
            }
          });

          if (loyaltyConfig && loyaltyConfig.isActive) {
            // Earn points on subtotal (items only)
            var pointsEarned = calculateLoyaltyPoints(
              loyaltyConfig,
              invoice.subtotal,
              invoice.discountAmount
            );

            if (pointsEarned !== null && pointsEarned > 0) {
              // Update points earned on Invoice
              await tx.invoice.update({
                where: { id: invoice.id },
                data: { pointsEarned: pointsEarned }
              });

              // Find or create customer membership
              var membership = await tx.customerMembership.findFirst({
                where: { customerId: customerId }
              });

              if (!membership) {
                membership = await tx.customerMembership.create({
                  data: {
                    customerId: customerId,
                    totalPoints: 0,
                    totalSpent: 0
                  }
                });
              }

              // Update membership points and total spent
              var updatedMembership = await tx.customerMembership.update({
                where: { id: membership.id },
                data: {
                  totalPoints: membership.totalPoints + pointsEarned,
                  totalSpent: membership.totalSpent + invoice.totalAmount
                }
              });

              // Create point transaction record
              await tx.pointTransaction.create({
                data: {
                  customerMembershipId: updatedMembership.id,
                  orderId: orderId,
                  type: 'earn',
                  points: pointsEarned,
                  note: 'Loyalty points earned for delivered order'
                }
              });
            }
          }
        }
      }
    }

    return { success: true, message: 'Delivery status updated successfully' };
  });
}

module.exports = {
  createDeliveryOrder: createDeliveryOrder,
  getDeliveryOrders: getDeliveryOrders,
  assignShipper: assignShipper,
  updateDeliveryStatus: updateDeliveryStatus
};
