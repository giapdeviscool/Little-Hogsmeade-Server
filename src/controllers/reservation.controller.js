var reservationService = require('../services/reservation.service');

async function checkIn(req, res, next) {
  try {
    var result = await reservationService.checkInReservation(req.params.id, req.body, req.user);
    res.json({
      status: 'success',
      message: 'Reservation checked in successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function markNoShow(req, res, next) {
  try {
    var result = await reservationService.markReservationNoShow(req.params.id, req.user);
    res.json({
      status: 'success',
      message: 'Reservation marked as no-show',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkIn: checkIn,
  markNoShow: markNoShow
};
