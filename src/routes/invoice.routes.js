var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var invoiceController = require('../controllers/invoice.controller');
var invoiceValidator = require('../validators/invoice.validator');

var router = express.Router();
router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'cashier']));

router.get('/', invoiceValidator.validateGetInvoicesQuery, invoiceController.getInvoices);
router.get('/admin', authMiddleware.verifyRole(['owner', 'chain admin', 'admin']), invoiceController.getAdminInvoices);
router.get('/:id', invoiceValidator.validateGetInvoiceByIdParam, invoiceController.getInvoiceById);

module.exports = router;
