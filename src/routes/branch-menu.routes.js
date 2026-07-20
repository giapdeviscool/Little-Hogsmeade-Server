var express = require('express');
var prisma = require('../lib/prisma');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin']));

// GET menu cho branch: global items + branch-specific items
router.get('/:branchId/menu', async function(req, res, next) {
  try {
    var categories = await prisma.category.findMany({
      where: { branchId: null, isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, displayOrder: true, isActive: true }
    });

    // Global items + items riêng của branch
    var menuItems = await prisma.menuItem.findMany({
      where: {
        OR: [
          { branchId: null, isActive: true },
          { branchId: req.params.branchId }
        ]
      },
      orderBy: { name: 'asc' },
      select: {
        id: true, categoryId: true, branchId: true, name: true,
        description: true, imageUrl: true, basePrice: true,
        isActive: true, isFeatured: true, itemType: true
      }
    });

    res.json({ data: { categories, menuItems } });
  } catch (error) { next(error); }
});

// PUT cập nhật items riêng của branch (isActive, basePrice)
router.put('/:branchId/items', async function(req, res, next) {
  try {
    var items = req.body.items || [];
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var data = {};
      if (item.isActive !== undefined) data.isActive = item.isActive;
      if (item.basePrice !== undefined) data.basePrice = item.basePrice;
      await prisma.menuItem.update({
        where: { id: item.menuItemId },
        data: data
      });
    }
    res.json({ data: { updated: items.length } });
  } catch (error) { next(error); }
});

module.exports = router;
