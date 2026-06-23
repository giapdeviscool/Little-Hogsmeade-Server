var tableService = require('../services/table.service');

async function getTableLayout(req, res, next) {
  try {
    var layout = await tableService.getTableLayout(req.params.branchId, req.query, req.user);
    res.json({
      status: 'success',
      message: 'Lấy danh sách sơ đồ bàn thành công',
      data: layout
    });
  } catch (error) {
    next(error);
  }
}

async function updateTableStatus(req, res, next) {
  try {
    var table = await tableService.updateTableStatus(req.params.id, req.body, req.user);
    res.json({
      status: 'success',
      message: 'Cập nhật trạng thái bàn thành công',
      data: table
    });
  } catch (error) {
    next(error);
  }
}

async function getCurrentOrder(req, res, next) {
  try {
    var order = await tableService.getCurrentOrder(req.params.id, req.user);
    res.json({
      status: 'success',
      data: order
    });
  } catch (error) {
    next(error);
  }
}

async function getTableReservation(req, res, next) {
  try {
    var reservation = await tableService.getTableReservation(req.params.id, req.user);
    res.json({
      status: 'success',
      data: reservation
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTableLayout: getTableLayout,
  getCurrentOrder: getCurrentOrder,
  getTableReservation: getTableReservation,
  updateTableStatus: updateTableStatus
};
