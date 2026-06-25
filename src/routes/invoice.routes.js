var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var invoiceController = require('../controllers/invoice.controller');
var invoiceValidator = require('../validators/invoice.validator');

var router = express.Router();

router.get('/', authMiddleware.authenticate, invoiceValidator.validateGetInvoicesQuery, invoiceController.getInvoices);
router.get('/admin', authMiddleware.authenticate, authMiddleware.verifyRole(['chain_admin']), invoiceController.getAdminInvoices);
router.get('/:id', authMiddleware.authenticate, invoiceValidator.validateGetInvoiceByIdParam, invoiceController.getInvoiceById);

module.exports = router;
