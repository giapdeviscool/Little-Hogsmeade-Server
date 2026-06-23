var orderService = require('../services/order.service');

async function createOrder(req, res, next) {
  try {
    var result = await orderService.createOrder(
      req.user && req.user.branchId,
      req.user && req.user.id,
      req.body
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    var result = await orderService.updateOrderStatus(req.params.id, req.body.status);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function deleteOrder(req, res, next) {
  try {
    await orderService.deleteOrder(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder: createOrder,
  updateOrderStatus: updateOrderStatus,
  deleteOrder: deleteOrder
};
