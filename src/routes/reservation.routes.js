var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var reservationValidator = require('../validators/reservation.validator');
var reservationController = require('../controllers/reservation.controller');

var router = express.Router();

router.get('/',
  authMiddleware.authenticate,
  reservationController.getReservations
);

router.post('/:id/check-in',
  authMiddleware.authenticate,
  authMiddleware.verifyRole(['owner', 'chain admin', 'cashier', 'staff']),
  validate(reservationValidator.checkInSchema),
  reservationController.checkIn
);

router.patch('/:id/status',
  authMiddleware.authenticate,
  authMiddleware.verifyRole(['owner', 'chain admin', 'cashier', 'staff']),
  validate(reservationValidator.statusSchema),
  reservationController.updateStatus
);

router.patch('/:id/assign-table',
  authMiddleware.authenticate,
  authMiddleware.verifyRole(['owner', 'chain admin', 'staff', 'cashier']),
  reservationController.assignTable
);

module.exports = router;
