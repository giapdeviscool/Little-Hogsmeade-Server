var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var orderController = require('../controllers/order.controller');
var validate = require('../middlewares/validate.middleware');
var orderValidator = require('../validators/order.validator');

var router = express.Router();
var orderAuth = [authMiddleware.authenticate, authMiddleware.verifyRole(['owner', 'chain admin', 'cashier', 'kitchen'])];

router.post('/', orderAuth, validate(orderValidator.createOrderSchema), orderController.createOrder);
router.post('/:id/items',
  orderAuth,
  validate(orderValidator.addOrderItemsSchema),
  orderController.addItems
);
router.post('/:id/change-table',
  orderAuth,
  validate(orderValidator.changeTableSchema),
  orderController.changeTable
);
router.patch('/:id/status', orderAuth, validate(orderValidator.updateOrderStatusSchema), orderController.updateOrderStatus);
router.delete('/:id', [authMiddleware.authenticate, authMiddleware.verifyRole(['owner', 'chain admin'])], orderController.deleteOrder);

module.exports = router;
