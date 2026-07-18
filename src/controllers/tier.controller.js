const prisma = require('../lib/prisma');

async function getTiers(req, res, next) {
  try {
    const tiers = await prisma.membershipTier.findMany({
      orderBy: { minPoints: 'asc' }
    });
    res.json({ data: tiers });
  } catch (error) {
    next(error);
  }
}

async function createTier(req, res, next) {
  try {
    const { name, minPoints, discountPercent, description } = req.body;
    
    if (!name || minPoints === undefined) {
      return res.status(400).json({ message: 'Name and minPoints are required' });
    }

    const tier = await prisma.membershipTier.create({
      data: {
        name,
        minPoints: parseInt(minPoints),
        discountPercent: parseFloat(discountPercent) || 0,
        description: description || null
      }
    });

    res.json({ data: tier });
  } catch (error) {
    next(error);
  }
}

async function updateTier(req, res, next) {
  try {
    const { id } = req.params;
    const { name, minPoints, discountPercent, description } = req.body;

    const tier = await prisma.membershipTier.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        minPoints: minPoints !== undefined ? parseInt(minPoints) : undefined,
        discountPercent: discountPercent !== undefined ? parseFloat(discountPercent) : undefined,
        description: description !== undefined ? description : undefined
      }
    });

    res.json({ data: tier });
  } catch (error) {
    next(error);
  }
}

async function deleteTier(req, res, next) {
  try {
    const { id } = req.params;
    
    // Check if any memberships are using this tier
    const count = await prisma.customerMembership.count({
      where: { tierId: id }
    });

    if (count > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa hạng thẻ này vì đang có khách hàng thuộc hạng này.' 
      });
    }

    await prisma.membershipTier.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTiers,
  createTier,
  updateTier,
  deleteTier
};
