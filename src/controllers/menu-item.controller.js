var menuItemService = require('../services/menu-item.service');
var cloudinaryUpload = require('../utils/cloudinary-upload');

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
    var fileUrl = null;
    if (req.file) {
      if (!cloudinaryUpload.isCloudinaryConfigured()) {
        var errConfig = new Error("Cloudinary environment variables are missing");
        errConfig.status = 500;
        throw errConfig;
      }
      var resultObj = await cloudinaryUpload.uploadBufferToCloudinary(
        req.file.buffer,
        {
          folder: "little-hogsmeade/menu-items",
          resource_type: "image",
        }
      );
      fileUrl = resultObj.secure_url;
    }

    var result = await menuItemService.createMenuItem(req.body, req.user, fileUrl);
    res.status(201).json({ message: 'Menu item created successfully', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    var id = req.params.id;
    var isActive = req.body.isActive === true || req.body.isActive === 'true';
    
    var result = await menuItemService.updateMenuItemStatus(id, isActive, req.user);
    res.json({ message: 'Item status updated successfully', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function updateMenuItem(req, res, next) {
  try {
    var id = req.params.id;
    var fileUrl = null;
    if (req.file) {
      if (!cloudinaryUpload.isCloudinaryConfigured()) {
        var errConfig = new Error("Cloudinary environment variables are missing");
        errConfig.status = 500;
        throw errConfig;
      }
      var resultObj = await cloudinaryUpload.uploadBufferToCloudinary(
        req.file.buffer,
        {
          folder: "little-hogsmeade/menu-items",
          resource_type: "image",
        }
      );
      fileUrl = resultObj.secure_url;
    }

    var result = await menuItemService.updateMenuItem(id, req.body, req.user, fileUrl);
    res.json({ message: 'Menu item updated successfully', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

async function moveItemsToCategory(req, res, next) {
  try {
    var menuItemIds = req.body.menuItemIds;
    var categoryId = req.body.categoryId;
    
    var result = await menuItemService.moveItemsToCategory(menuItemIds, categoryId, req.user);
    res.json({ message: 'Menu items moved successfully', data: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    next(error);
  }
}

module.exports = {
  getMenuItems: getMenuItems,
  createMenuItem: createMenuItem,
  updateStatus: updateStatus,
  updateMenuItem: updateMenuItem,
  moveItemsToCategory: moveItemsToCategory
};
