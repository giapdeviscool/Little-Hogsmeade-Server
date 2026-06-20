var express = require('express');
var menuItemController = require('../controllers/menu-item.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var uploadMiddleware = require('../middlewares/upload.middleware');

var router = express.Router();

// UC65: View Menu Items
router.get('/', authMiddleware.authenticate, menuItemController.getMenuItems);

// UC66: Add Menu Items
router.post('/', 
  authMiddleware.authenticate, 
  authMiddleware.requireChainRole, 
  uploadMiddleware.single('image'), 
  menuItemController.createMenuItem
);

module.exports = router;
