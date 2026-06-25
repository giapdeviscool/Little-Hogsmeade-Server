var express = require('express');
var deliveryController = require('../controllers/delivery.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);

router.get('/', deliveryController.getDeliveryOrders);
router.put('/:deliveryId/assign', deliveryController.assignShipper);
router.patch('/:deliveryId/status', deliveryController.updateDeliveryStatus);

module.exports = router;
