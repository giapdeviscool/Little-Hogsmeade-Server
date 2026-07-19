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
      orderBy: { name: 'asc' },
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

    // Categories are global — only null branchId (no old branch copies)
    var categories = await prisma.category.findMany({
      where: { branchId: null, isActive: true },
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
