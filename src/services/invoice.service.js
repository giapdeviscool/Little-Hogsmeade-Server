var invoiceRepository = require('../repositories/invoice.repository');
var cashierShiftRepository = require('../repositories/cashier-shift.repository');

async function getInvoices(query, user) {
  var page = parseInt(query.page, 10) || 1;
  var limit = parseInt(query.limit, 10) || 20;
  var skip = (page - 1) * limit;

  var filters = {
    startDate: query.startDate ? new Date(query.startDate) : undefined,
    endDate: query.endDate ? new Date(query.endDate) : undefined,
    status: query.status,
    orderId: query.order_id,
    id: query.id,
    paymentMethod: query.paymentMethod,
    customerName: query.customerName,
    minAmount: query.minAmount !== undefined ? parseFloat(query.minAmount) : undefined,
    maxAmount: query.maxAmount !== undefined ? parseFloat(query.maxAmount) : undefined
  };

  var roleName = (user && user.roleName || '').trim().toLowerCase();
  var isOwner = roleName.indexOf('owner') > -1 || roleName.indexOf('chain owner') > -1;
  var isAdmin = roleName.indexOf('chain admin') > -1 || roleName.indexOf('admin') > -1;
  var isCashier = roleName.indexOf('cashier') > -1;

  if (isCashier) {
    filters.employeeId = user.id;
    filters.branchId = user.branchId;
    
    // Check if cashier wants current shift or history
    if (query.currentShift === 'true' || query.currentShift === true) {
      var activeShift = await cashierShiftRepository.findActiveCashierShiftByBranch(user.branchId);
      filters.cashierShiftId = activeShift ? activeShift.id : 'non_existent_id';
    } else if (query.cashierShiftId || query.shiftId) {
      filters.cashierShiftId = query.cashierShiftId || query.shiftId;
    }
  } else if (isAdmin) {
    filters.branchId = user.branchId;
    if (query.cashierShiftId || query.shiftId) {
      filters.cashierShiftId = query.cashierShiftId || query.shiftId;
    }
  } else if (isOwner) {
    var queryBranchId = query.branchId || query.branch_id;
    if (queryBranchId) {
      filters.branchId = queryBranchId;
    }
    if (query.cashierShiftId || query.shiftId) {
      filters.cashierShiftId = query.cashierShiftId || query.shiftId;
    }
  }

  var sortBy = query.sortBy || 'createdAt';
  var sortOrder = query.sortOrder ? query.sortOrder.toLowerCase() : 'desc';
  
  // Safe field mapping for sortBy
  var allowedSortFields = ['createdAt', 'totalAmount', 'status', 'printedAt'];
  if (allowedSortFields.indexOf(sortBy) === -1) {
    sortBy = 'createdAt';
  }

  var result = await invoiceRepository.findInvoices(filters, skip, limit, sortBy, sortOrder);

  var totalRecords = result.totalCount;
  var totalPages = Math.ceil(totalRecords / limit);

  return {
    data: result.data,
    pagination: {
      totalRecords: totalRecords,
      currentPage: page,
      totalPages: totalPages === 0 ? 1 : totalPages,
      limit: limit
    }
  };
}
async function getInvoiceById(id) {
  return invoiceRepository.findInvoiceById(id);
}

async function getAdminInvoices(query, user) {
  var page = parseInt(query.page, 10) || 1;
  var limit = parseInt(query.limit, 10) || 20;
  var skip = (page - 1) * limit;

  var branchId = query.branchId || (user && user.branchId) || null;
  if (branchId) {
    if (typeof branchId !== 'string' || !/^[a-f\d]{24}$/i.test(branchId)) {
      throwHttpError(400, 'branchId must be a valid ObjectId');
    }
  }

  var status = query.status;
  if (status) {
    if (['paid', 'unpaid', 'refunded'].indexOf(status) === -1) {
      throwHttpError(400, 'Invalid status parameter');
    }
  }

  var paymentMethod = query.paymentMethod;
  if (paymentMethod) {
    if (['cash', 'vietqr'].indexOf(paymentMethod) === -1) {
      throwHttpError(400, 'Invalid paymentMethod parameter');
    }
  }

  var cashierId = query.cashierId;
  if (cashierId) {
    if (typeof cashierId !== 'string' || !/^[a-f\d]{24}$/i.test(cashierId)) {
      throwHttpError(400, 'cashierId must be a valid ObjectId');
    }
  }

  var startDate = null;
  var endDate = null;
  if (query.startDate) {
    startDate = new Date(query.startDate);
    if (isNaN(startDate.getTime())) {
      throwHttpError(400, 'Invalid startDate format');
    }
  }
  if (query.endDate) {
    endDate = new Date(query.endDate);
    if (isNaN(endDate.getTime())) {
      throwHttpError(400, 'Invalid endDate format');
    }
  }

  var filters = {
    branchId: branchId,
    status: status,
    paymentMethod: paymentMethod,
    cashierId: cashierId,
    startDate: startDate,
    endDate: endDate
  };

  var result = await invoiceRepository.findAdminInvoices(filters, skip, limit);

  var formattedData = result.data.map(function(invoice) {
    var cashierInfo = null;
    if (invoice.order && invoice.order.employee) {
      cashierInfo = {
        name: invoice.order.employee.fullName,
        employeeCode: invoice.order.employee.phone || invoice.order.employee.id.slice(-6)
      };
    }

    var customerInfo = null;
    if (invoice.order && invoice.order.customer) {
      customerInfo = {
        id: invoice.order.customer.id,
        fullName: invoice.order.customer.fullName,
        phone: invoice.order.customer.phone,
        email: invoice.order.customer.email
      };
    }

    var orderInfo = null;
    if (invoice.order) {
      var items = [];
      if (invoice.order.orderItems) {
        items = invoice.order.orderItems.map(function(item) {
          return {
            name: item.menuItem ? item.menuItem.name : 'Unknown Item',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal
          };
        });
      }

      orderInfo = {
        tableId: invoice.order.tableId,
        items: items
      };
    }

    return {
      id: invoice.id,
      subtotal: invoice.subtotal,
      discountAmount: invoice.discountAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      pointsUsed: invoice.pointsUsed,
      pointsEarned: invoice.pointsEarned,
      voucherId: invoice.voucherId,
      status: invoice.status,
      printedAt: invoice.printedAt,
      createdAt: invoice.createdAt,
      cashierId: cashierInfo,
      orderId: orderInfo,
      customer: customerInfo,
      payments: invoice.payments
    };
  });

  var totalDocs = result.totalCount;
  var totalPages = Math.ceil(totalDocs / limit);

  return {
    data: formattedData,
    pagination: {
      totalDocs: totalDocs,
      totalPages: totalPages === 0 ? 1 : totalPages,
      currentPage: page,
      limit: limit
    }
  };
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  getInvoices: getInvoices,
  getInvoiceById: getInvoiceById,
  getAdminInvoices: getAdminInvoices
};
