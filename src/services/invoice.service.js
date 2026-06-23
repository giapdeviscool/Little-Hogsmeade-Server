var invoiceRepository = require('../repositories/invoice.repository');

async function getInvoices(query) {
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

module.exports = {
  getInvoices: getInvoices,
  getInvoiceById: getInvoiceById
};
