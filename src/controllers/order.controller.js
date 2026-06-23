var orderService = require("../services/order.service");

async function createOrder(req, res, next) {
  try {
    var result = await orderService.createOrder(
      req.user && req.user.branchId,
      req.user && req.user.id,
      req.body,
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function addItems(req, res, next) {
  try {
    var result = await orderService.addOrderItems(req.params.id, req.body.items, req.user);
    res.status(201).json({
      status: 'success',
      message: 'Items added to order successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    var result = await orderService.updateOrderStatus(
      req.params.id,
      req.body.status,
    );
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function changeTable(req, res, next) {
  try {
    var result = await orderService.changeOrderTable(
      req.params.id,
      req.body.targetTableId,
      req.user,
    );
    res.json({
      status: "success",
      message: "Table changed successfully",
      data: result,
    });
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
  addItems: addItems,
  updateOrderStatus: updateOrderStatus,
  changeTable: changeTable,
  deleteOrder: deleteOrder,
};
