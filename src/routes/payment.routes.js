var express = require('express');
var paymentController = require('../controllers/payment.controller');
var paymentWebhookController = require('../controllers/payment.webhook');
var sepayAuth = require('../middlewares/sepayAuth');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var orderValidator = require('../validators/order.validator');

var router = express.Router();

// get noti from web hook => do not add authentication to this api
// Webhook is public to bank networks, protected via strict SePay HMAC verification
router.get('/bank-webhook', (req, res) => {
  res.status(200).json({ success: true, message: 'SePay Webhook endpoint is active and listening.' });
});


router.post('/bank-webhook', sepayAuth, paymentWebhookController.handleSePayWebhook);

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'cashier']));



// POS actions require standard employee authentication
router.post('/qr-intent', authMiddleware.authenticate, validate(orderValidator.qrIntentSchema), paymentController.createQrIntent);
router.post('/cash-settle', authMiddleware.authenticate, validate(orderValidator.cashSettlementSchema), paymentController.cashSettle);

module.exports = router;
