var menuItemService = require('../services/menu-item.service');

async function getMenuItems(req, res, next) {
  try {
    var result = await menuItemService.getMenuItems(req.query || {}, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function createMenuItem(req, res, next) {
  try {
    var fileUrl = req.file ? req.file.path : null;
    var result = await menuItemService.createMenuItem(req.body, req.user, fileUrl);
    res.status(201).json({ message: 'Menu item created successfully', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = {
  getMenuItems: getMenuItems,
  createMenuItem: createMenuItem
};
