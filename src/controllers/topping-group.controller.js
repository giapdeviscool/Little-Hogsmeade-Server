var toppingGroupService = require('../services/topping-group.service');

async function getToppingGroups(req, res, next) {
  try {
    var result = await toppingGroupService.getToppingGroups(req.user);
    res.json({ message: 'Lấy danh sách nhóm Topping thành công', data: result });
  } catch (error) {
    next(error);
  }
}

async function createToppingGroup(req, res, next) {
  try {
    var result = await toppingGroupService.createToppingGroup(req.body, req.user);
    res.status(201).json({ message: 'Tạo nhóm Topping thành công', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function softDeleteToppingGroup(req, res, next) {
  try {
    var id = req.params.id;
    var result = await toppingGroupService.softDeleteToppingGroup(id, req.user);
    res.json({ message: 'Đã xoá nhóm Topping', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = {
  getToppingGroups: getToppingGroups,
  createToppingGroup: createToppingGroup,
  softDeleteToppingGroup: softDeleteToppingGroup
};
