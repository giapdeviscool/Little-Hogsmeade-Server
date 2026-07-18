var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var tableValidator = require('../validators/table.validator');
var tableController = require('../controllers/table.controller');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager', 'cashier', 'staff']));


router.get('/:id/current-order',
  authMiddleware.authenticate,
  tableController.getCurrentOrder
);

router.get('/:id/reservation',
  authMiddleware.authenticate,
  tableController.getTableReservation
);

router.patch('/:id/status',
  authMiddleware.authenticate,
  validate(tableValidator.updateTableStatusSchema),
  tableController.updateTableStatus
);

module.exports = router;
