var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var orderController = require('../controllers/order.controller');
var validate = require('../middlewares/validate.middleware');
var orderValidator = require('../validators/order.validator');

var router = express.Router();

router.post('/', authMiddleware.authenticate, validate(orderValidator.createOrderSchema), orderController.createOrder);
router.post('/:id/items',
  authMiddleware.authenticate,
  validate(orderValidator.addOrderItemsSchema),
  orderController.addItems
);
router.post('/:id/change-table',
  authMiddleware.authenticate,
  validate(orderValidator.changeTableSchema),
  orderController.changeTable
);
router.patch('/:id/status', authMiddleware.authenticate, validate(orderValidator.updateOrderStatusSchema), orderController.updateOrderStatus);
router.delete('/:id', authMiddleware.authenticate, orderController.deleteOrder);

module.exports = router;
