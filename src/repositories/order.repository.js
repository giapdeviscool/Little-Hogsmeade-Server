var prisma = require('../lib/prisma');

function getDb(tx) {
  return tx || prisma;
}

function createOrder(data, tx) {
  // Build data object with all required fields and relations
  const createData = Object.assign({}, data, {
    orderType: data.orderType,
    createdAt: data.createdAt || new Date(),
    updatedAt: new Date()
  });

  // Convert branchId scalar to branch relation connect
  if (createData.branchId && !createData.branch) {
    createData.branch = { connect: { id: createData.branchId } };
    delete createData.branchId;
  }

  // Convert employeeId scalar to employee relation connect
  if (createData.employeeId && !createData.employee) {
    createData.employee = { connect: { id: createData.employeeId } };
    delete createData.employeeId;
  }

  // Handle optional customerId: convert to customer relation connect if provided
  if (createData.customerId && !createData.customer) {
    createData.customer = { connect: { id: createData.customerId } };
    delete createData.customerId;
  }

  // Remove customerId if null to avoid relation issues
  if (createData.customerId === null) {
    delete createData.customerId;
    delete createData.customer;
  }

  // Handle optional tableId as a relation, like branch and employee above.
  if (createData.tableId && !createData.table) {
    createData.table = { connect: { id: createData.tableId } };
    delete createData.tableId;
  }

  if (createData.tableId === null) {
    delete createData.tableId;
    delete createData.table;
  }

  // Handle optional cashierShiftId as a relation
  if (createData.cashierShiftId && !createData.cashierShift) {
    createData.cashierShift = { connect: { id: createData.cashierShiftId } };
    delete createData.cashierShiftId;
  }

  if (createData.cashierShiftId === null) {
    delete createData.cashierShiftId;
    delete createData.cashierShift;
  }

  // DEBUG: show what is being sent to Prisma (remove in production)
  try {
    console.log('[order.repository] createData:', JSON.stringify(createData));
  } catch (e) {
    console.log('[order.repository] createData: <unserializable>');
  }

  return getDb(tx).order.create({
    data: createData,
    include: {
      branch: true,
      employee: true,
      customer: true,
      orderItems: true,
      invoices: true
    }
  });
}

function findOrderById(id, tx) {
  return getDb(tx).order.findUnique({
    where: { id: id }
  });
}

function updateOrderStatus(id, status, tx) {
  return getDb(tx).order.update({
    where: { id: id },
    data: { status: status }
  });
}

function deleteOrderById(id, tx) {
  return getDb(tx).order.delete({
    where: { id: id }
  });
}

async function countPendingOrdersForBranch(branchId, tx) {
  var db = getDb(tx);
  var openStatuses = ['pending', 'confirmed', 'preparing', 'in_progress', 'serving', 'open'];
  
  var count = await db.order.count({
    where: {
      branchId: branchId,
      status: {
        in: openStatuses
      }
    }
  });
  
  return count;
}

module.exports = {
  createOrder: createOrder,
  findOrderById: findOrderById,
  updateOrderStatus: updateOrderStatus,
  deleteOrderById: deleteOrderById,
  countPendingOrdersForBranch: countPendingOrdersForBranch
};
