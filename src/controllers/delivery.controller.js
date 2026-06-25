var deliveryService = require('../services/delivery.service');

async function createDeliveryOrder(req, res, next) {
  try {
    var result = await deliveryService.createDeliveryOrder(req.body, req.user);
    res.status(201).json({
      success: true,
      order_id: result.order_id,
      delivery_order_id: result.delivery_order_id,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getDeliveryOrders(req, res, next) {
  try {
    var result = await deliveryService.getDeliveryOrders(req.query, req.user);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function assignShipper(req, res, next) {
  try {
    var deliveryId = req.params.deliveryId;
    var employeeId = req.body.delivery_employee_id;
    var result = await deliveryService.assignShipper(deliveryId, employeeId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function updateDeliveryStatus(req, res, next) {
  try {
    var deliveryId = req.params.deliveryId;
    var result = await deliveryService.updateDeliveryStatus(deliveryId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createDeliveryOrder: createDeliveryOrder,
  getDeliveryOrders: getDeliveryOrders,
  assignShipper: assignShipper,
  updateDeliveryStatus: updateDeliveryStatus
};
