var express = require('express');

var prisma = require('../lib/prisma');

var router = express.Router();

router.get('/', async function (req, res, next) {
  try {
    var categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        name: true,
        displayOrder: true,
      },
    });

    var menuItems = await prisma.menuItem.findMany({
      where: { branchId: null, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        imageUrl: true,
        basePrice: true,
        isFeatured: true,
        menuItemVariants: true,
        menuItemToppingGroups: {
          include: {
            toppingGroup: {
              include: {
                toppings: {
                  where: { isActive: true },
                },
              },
            },
          },
        },
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

router.get('/top-selling', async function (req, res, next) {
  try {
    // Get top 6 menu items by quantity sold in completed orders
    var topSelling = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: 6,
    });

    var topMenuItemIds = topSelling.map(function (item) {
      return item.menuItemId;
    });

    var menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: topMenuItemIds },
        isActive: true,
      },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        imageUrl: true,
        basePrice: true,
      },
    });

    // Sort to match the order of topSelling
    var sortedMenuItems = menuItems.sort(function (a, b) {
      return topMenuItemIds.indexOf(a.id) - topMenuItemIds.indexOf(b.id);
    });

    // Pad with other featured or active items if less than 6
    if (sortedMenuItems.length < 6) {
      var remainingCount = 6 - sortedMenuItems.length;
      var existingIds = sortedMenuItems.map(function(item) { return item.id; });
      var additionalItems = await prisma.menuItem.findMany({
        where: {
          id: { notIn: existingIds },
          isActive: true,
        },
        orderBy: [
          { isFeatured: 'desc' },
          { name: 'asc' }
        ],
        take: remainingCount,
        select: {
          id: true,
          categoryId: true,
          name: true,
          description: true,
          imageUrl: true,
          basePrice: true,
        },
      });
      sortedMenuItems = sortedMenuItems.concat(additionalItems);
    }

    res.json({
      data: sortedMenuItems,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:branchId', async function (req, res, next) {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.branchId)) {
      return res.status(400).json({ message: 'Invalid branch ID' });
    }

    var branch = await prisma.branch.findUnique({
      where: { id: req.params.branchId }
    });

    if (!branch || branch.status !== 'active') {
      return res.status(404).json({ message: 'Branch not found or inactive' });
    }

    // Categories are global
    var categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, displayOrder: true }
    });

    // Lấy global items + branch-specific items
    var menuItems = await prisma.menuItem.findMany({
      where: {
        OR: [
          { branchId: null },
          { branchId: req.params.branchId }
        ],
        isActive: true
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        imageUrl: true,
        basePrice: true,
        isFeatured: true
      }
    });

    res.json({
      data: {
        categories: categories,
        menuItems: menuItems
      },
      branch: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        openTime: branch.openTime,
        closeTime: branch.closeTime,
        imageUrl: branch.imageUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
