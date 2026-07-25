var prisma = require('../lib/prisma');

function getDb(tx) {
  return tx || prisma;
}

function createOrderItem(data, tx) {
  return getDb(tx).orderItem.create({
    data: data
  });
}

function createOrderItemTopping(data, tx) {
  return getDb(tx).orderItemTopping.create({
    data: data
  });
}

function findOrderItemsByOrderId(orderId, tx) {
  return getDb(tx).orderItem.findMany({
    where: { orderId: orderId }
  });
}

function deleteOrderItemToppingsByOrderItemIds(orderItemIds, tx) {
  return getDb(tx).orderItemTopping.deleteMany({
    where: { orderItemId: { in: orderItemIds } }
  });
}

function deleteOrderItemsByOrderId(orderId, tx) {
  return getDb(tx).orderItem.deleteMany({
    where: { orderId: orderId }
  });
}

module.exports = {
  createOrderItem: createOrderItem,
  createOrderItemTopping: createOrderItemTopping,
  findOrderItemsByOrderId: findOrderItemsByOrderId,
  deleteOrderItemToppingsByOrderItemIds: deleteOrderItemToppingsByOrderItemIds,
  deleteOrderItemsByOrderId: deleteOrderItemsByOrderId
};
