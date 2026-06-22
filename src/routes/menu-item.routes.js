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

var menuItemToppingController = require('../controllers/menu-item-topping.controller');

// UC69: Assign Topping Groups
router.get('/:id/topping-groups', authMiddleware.authenticate, authMiddleware.requireChainRole, menuItemToppingController.getMenuItemToppings);
router.put('/:id/topping-groups', authMiddleware.authenticate, authMiddleware.requireChainRole, menuItemToppingController.assignToppingGroups);

var recipeController = require('../controllers/recipe.controller');
// UC71 & UC72: Set up and Update ingredient quantities
router.put('/:id/recipes', authMiddleware.authenticate, authMiddleware.requireChainRole, recipeController.setMenuItemRecipes);

module.exports = router;
