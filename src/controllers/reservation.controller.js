var reservationService = require('../services/reservation.service');

async function getReservations(req, res, next) {
  try {
    var branchId = req.query.branchId;
    var result = await reservationService.getReservations(req.user, branchId);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

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

async function updateStatus(req, res, next) {
  try {
    var result = await reservationService.updateReservationStatus(req.params.id, req.body.status, req.user);
    res.json({
      status: 'success',
      message: 'Cập nhật trạng thái thành công',
      data: result.reservation
    });
  } catch (error) {
    next(error);
  }
}

async function assignTable(req, res, next) {
  try {
    var result = await reservationService.assignTableToReservation(req.params.id, req.body.tableId, req.user);
    res.json({
      status: 'success',
      message: 'Đã gán bàn thành công',
      data: result.reservation
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getReservations: getReservations,
  checkIn: checkIn,
  updateStatus: updateStatus,
  assignTable: assignTable
};
