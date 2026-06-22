var menuItemToppingService = require('../services/menu-item-topping.service');

async function getMenuItemToppings(req, res, next) {
  try {
    var menuItemId = req.params.id;
    var result = await menuItemToppingService.getMenuItemToppings(menuItemId, req.user);
    res.json({ message: 'Lấy danh sách nhóm Topping thành công', data: result });
  } catch (error) {
    next(error);
  }
}

async function assignToppingGroups(req, res, next) {
  try {
    var menuItemId = req.params.id;
    var toppingGroupIds = req.body.toppingGroupIds || [];
    var result = await menuItemToppingService.assignToppingGroups(menuItemId, toppingGroupIds, req.user);
    res.json({ message: 'Gán nhóm Topping thành công', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = {
  getMenuItemToppings: getMenuItemToppings,
  assignToppingGroups: assignToppingGroups
};
