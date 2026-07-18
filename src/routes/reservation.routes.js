var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var reservationValidator = require('../validators/reservation.validator');
var reservationController = require('../controllers/reservation.controller');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager', 'cashier']));


router.post('/:id/check-in',
  authMiddleware.authenticate,
  validate(reservationValidator.checkInSchema),
  reservationController.checkIn
);

router.patch('/:id/status',
  authMiddleware.authenticate,
  validate(reservationValidator.noShowSchema),
  reservationController.markNoShow
);

module.exports = router;
