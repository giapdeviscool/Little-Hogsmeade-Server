var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var reservationValidator = require('../validators/reservation.validator');
var reservationController = require('../controllers/reservation.controller');

var router = express.Router();

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
