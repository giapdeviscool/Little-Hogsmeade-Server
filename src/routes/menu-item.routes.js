var express = require('express');
var menuItemController = require('../controllers/menu-item.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var imageUploadMiddleware = require('../middlewares/image-upload.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'cashier']));


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

// Move items to a category (Global Menu Feature)
router.patch('/move-category', authMiddleware.authenticate, authMiddleware.requireChainRole, menuItemController.moveItemsToCategory);

// Update item details
router.put('/:id',
  authMiddleware.authenticate,
  authMiddleware.requireChainRole,
  imageUploadMiddleware.singleImage('image'),
  menuItemController.updateMenuItem
);

var menuItemToppingController = require('../controllers/menu-item-topping.controller');

// UC69: Assign Topping Groups
router.get('/:id/topping-groups', authMiddleware.authenticate, menuItemToppingController.getMenuItemToppings);
router.put('/:id/topping-groups', authMiddleware.authenticate, authMiddleware.requireChainRole, menuItemToppingController.assignToppingGroups);

var recipeController = require('../controllers/recipe.controller');
// UC71 & UC72: Set up and Update ingredient quantities
router.put('/:id/recipes', authMiddleware.authenticate, authMiddleware.requireChainRole, recipeController.setMenuItemRecipes);

module.exports = router;
