var objectIdPattern = /^[a-f\d]{24}$/i;

function validateGetInvoicesQuery(req, res, next) {
  var query = req.query;
  var errors = [];

  if (query.startDate && isNaN(Date.parse(query.startDate))) {
    errors.push({ field: 'startDate', message: 'startDate must be a valid date string' });
  }

  if (query.endDate && isNaN(Date.parse(query.endDate))) {
    errors.push({ field: 'endDate', message: 'endDate must be a valid date string' });
  }

  if (query.status) {
    var validStatuses = ['unpaid', 'paid', 'cancelled', 'refunded'];
    if (validStatuses.indexOf(query.status) === -1) {
      errors.push({ field: 'status', message: 'status must be one of: ' + validStatuses.join(', ') });
    }
  }

  if (query.order_id && !objectIdPattern.test(query.order_id)) {
    errors.push({ field: 'order_id', message: 'order_id must be a valid object id' });
  }

  if (query.id && !objectIdPattern.test(query.id)) {
    errors.push({ field: 'id', message: 'id must be a valid object id' });
  }

  if (query.paymentMethod && typeof query.paymentMethod !== 'string') {
    errors.push({ field: 'paymentMethod', message: 'paymentMethod must be a string' });
  }

  if (query.customerName && typeof query.customerName !== 'string') {
    errors.push({ field: 'customerName', message: 'customerName must be a string' });
  }

  if (query.minAmount !== undefined && (isNaN(Number(query.minAmount)) || Number(query.minAmount) < 0)) {
    errors.push({ field: 'minAmount', message: 'minAmount must be a non-negative number' });
  }

  if (query.maxAmount !== undefined && (isNaN(Number(query.maxAmount)) || Number(query.maxAmount) < 0)) {
    errors.push({ field: 'maxAmount', message: 'maxAmount must be a non-negative number' });
  }

  if (query.page !== undefined && (!Number.isInteger(Number(query.page)) || Number(query.page) < 1)) {
    errors.push({ field: 'page', message: 'page must be a positive integer' });
  }

  if (query.limit !== undefined && (!Number.isInteger(Number(query.limit)) || Number(query.limit) < 1)) {
    errors.push({ field: 'limit', message: 'limit must be a positive integer' });
  }

  if (query.sortOrder !== undefined && ['asc', 'desc'].indexOf(query.sortOrder.toLowerCase()) === -1) {
    errors.push({ field: 'sortOrder', message: 'sortOrder must be asc or desc' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors
    });
  }

  next();
}

function validateGetInvoiceByIdParam(req, res, next) {
  if (!req.params.id || !objectIdPattern.test(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'id', message: 'Invalid invoice ID' }]
    });
  }
  next();
}

module.exports = {
  validateGetInvoicesQuery: validateGetInvoicesQuery,
  validateGetInvoiceByIdParam: validateGetInvoiceByIdParam
};
