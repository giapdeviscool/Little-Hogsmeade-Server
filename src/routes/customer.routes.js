var express = require('express');
var customerController = require('../controllers/customer.controller');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var customerValidator = require('../validators/customer.validator');

var router = express.Router();

router.get('/', authMiddleware.authenticate, customerController.listCustomers);
router.post('/quick-register', authMiddleware.authenticate, validate(customerValidator.quickRegisterSchema), customerController.quickRegisterCustomer);
router.get('/:id', authMiddleware.authenticate, customerController.getCustomerDetail);
router.get('/:id/orders', authMiddleware.authenticate, customerController.getCustomerOrders);
router.get('/:id/points', authMiddleware.authenticate, customerController.getCustomerPoints);

module.exports = router;
