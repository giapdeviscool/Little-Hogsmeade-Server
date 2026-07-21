var invoiceService = require('../services/invoice.service');

async function getInvoices(req, res, next) {
  try {
    var result = await invoiceService.getInvoices(req.query, req.user);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('getInvoices Error:', error);
    next(error);
  }
}

async function getInvoiceById(req, res, next) {
  try {
    var result = await invoiceService.getInvoiceById(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getAdminInvoices(req, res, next) {
  try {
    var result = await invoiceService.getAdminInvoices(req.query, req.user);
    
    res.status(200).json({
      success: true,
      pagination: result.pagination,
      summary: result.summary,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInvoices: getInvoices,
  getInvoiceById: getInvoiceById,
  getAdminInvoices: getAdminInvoices
};
