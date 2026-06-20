var express = require('express');
var menuItemController = require('../controllers/menu-item.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var imageUploadMiddleware = require('../middlewares/image-upload.middleware');

var router = express.Router();

// UC65: View Menu Items
router.get('/', authMiddleware.authenticate, menuItemController.getMenuItems);

// UC66: Add Menu Items
router.post('/', 
  authMiddleware.authenticate, 
  authMiddleware.requireChainRole, 
  imageUploadMiddleware.singleImage('image'), 
  menuItemController.createMenuItem
);
// UC67: Update item status
router.patch('/:id/status', authMiddleware.authenticate, menuItemController.updateStatus);

module.exports = router;
