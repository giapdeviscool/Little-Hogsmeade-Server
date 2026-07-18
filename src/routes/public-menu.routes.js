var express = require('express');

var prisma = require('../lib/prisma');

var router = express.Router();

router.get('/', async function (req, res, next) {
  try {
    var categories = await prisma.category.findMany({
      where: { branchId: null, isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        icon: true,
        displayOrder: true,
      },
    });

    var menuItems = await prisma.menuItem.findMany({
      where: { branchId: null, isActive: true },
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        imageUrl: true,
        basePrice: true,
        isFeatured: true,
      },
    });

    res.json({
      data: {
        categories: categories,
        menuItems: menuItems,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
