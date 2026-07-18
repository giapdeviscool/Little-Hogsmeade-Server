var express = require('express');
var customerController = require('../controllers/customer.controller');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var customerValidator = require('../validators/customer.validator');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager', 'cashier']));


router.get('/', authMiddleware.authenticate, customerController.listCustomers);
router.get('/auth/check-phone', customerController.checkPhoneAuth);
router.post('/auth/login', customerController.customerLogin);
router.post('/quick-register', authMiddleware.authenticate, validate(customerValidator.quickRegisterSchema), customerController.quickRegisterCustomer);
router.get('/:id', authMiddleware.authenticate, customerController.getCustomerDetail);
router.get('/:id/orders', authMiddleware.authenticate, customerController.getCustomerOrders);
router.get('/:id/points', authMiddleware.authenticate, customerController.getCustomerPoints);
router.put('/:id/membership', authMiddleware.authenticate, customerController.updateCustomerMembership);
router.post('/:id/loyalty/redeem', authMiddleware.authenticate, customerController.redeemLoyaltyReward);

module.exports = router;
