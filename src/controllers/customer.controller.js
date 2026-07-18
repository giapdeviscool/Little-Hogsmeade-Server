var crmCustomerService = require('../services/crm-customer.service');
var authMiddleware = require('../middlewares/auth.middleware');
var prisma = require('../lib/prisma');
var bcrypt = require('bcryptjs');

async function listCustomers(req, res, next) {
  try {
    if (req.query && req.query.phone) {
      var phoneResults = await crmCustomerService.searchByPhone(req.query.phone);
      return res.json({ data: phoneResults });
    }

    if (!req.user || req.user.type !== 'employee') {
      return res.status(403).json({ message: 'Employee access is required' });
    }

    if (!authMiddleware.isOwner(req.user) && !authMiddleware.isChainAdmin(req.user)) {
      return res.status(403).json({ message: 'Owner or Chain Admin role is required' });
    }

    var result = await crmCustomerService.getCustomers(req.user, req.query || {});
    return res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getCustomerById(req, res, next) {
  try {
    if (!req.user || req.user.type !== 'employee') {
      return res.status(403).json({ message: 'Employee access is required' });
    }

    if (!authMiddleware.isOwner(req.user) && !authMiddleware.isChainAdmin(req.user)) {
      return res.status(403).json({ message: 'Owner or Chain Admin role is required' });
    }

    var result = await crmCustomerService.getCustomerById(req.params.id, req.user);
    return res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getCustomerDetail(req, res, next) {
  try {
    if (!req.user || req.user.type !== 'employee') {
      return res.status(403).json({ message: 'Employee access is required' });
    }

    if (!authMiddleware.isOwner(req.user) && !authMiddleware.isChainAdmin(req.user)) {
      return res.status(403).json({ message: 'Owner or Chain Admin role is required' });
    }

    var result = await crmCustomerService.getCustomerDetail(req.params.id, req.user);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'CUSTOMER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error_code: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy thông tin khách hàng trong hệ thống.'
      });
    }
    next(error);
  }
}

async function getCustomerOrders(req, res, next) {
  try {
    if (!req.user || req.user.type !== 'employee') {
      return res.status(403).json({ message: 'Employee access is required' });
    }

    if (!authMiddleware.isOwner(req.user) && !authMiddleware.isChainAdmin(req.user)) {
      return res.status(403).json({ message: 'Owner or Chain Admin role is required' });
    }

    var result = await crmCustomerService.getCustomerOrders(req.params.id, req.query || {});
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'CUSTOMER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error_code: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy thông tin khách hàng trong hệ thống.'
      });
    }
    next(error);
  }
}

async function getCustomerPoints(req, res, next) {
  try {
    if (!req.user || req.user.type !== 'employee') {
      return res.status(403).json({ message: 'Employee access is required' });
    }

    if (!authMiddleware.isOwner(req.user) && !authMiddleware.isChainAdmin(req.user)) {
      return res.status(403).json({ message: 'Owner or Chain Admin role is required' });
    }

    var result = await crmCustomerService.getCustomerPoints(req.params.id, req.query || {});
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.statusCode === 404 || error.code === 'CUSTOMER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error_code: 'CUSTOMER_NOT_FOUND',
        message: 'Không tìm thấy thông tin khách hàng trong hệ thống.'
      });
    }
    next(error);
  }
}

async function quickRegisterCustomer(req, res, next) {
  try {
    if (!req.user || req.user.type !== 'employee') {
      return res.status(403).json({ message: 'Employee access is required' });
    }

    var name = req.body.name;
    var phone = req.body.phone;

    // Step 1: Uniqueness Check
    var existingCustomer = await prisma.customer.findUnique({
      where: { phone: phone },
      include: {
        customerMemberships: true
      }
    });

    if (existingCustomer) {
      var points = existingCustomer.points;
      if (existingCustomer.customerMemberships && existingCustomer.customerMemberships.length > 0) {
        points = existingCustomer.customerMemberships[0].totalPoints;
      }

      return res.status(409).json({
        success: false,
        message: "Số điện thoại đã tồn tại trong hệ thống.",
        existingCustomer: {
          _id: existingCustomer.id,
          name: existingCustomer.name || existingCustomer.fullName,
          phone: existingCustomer.phone,
          points: points
        }
      });
    }

    // Step 2: Creation
    var defaultTier = await prisma.membershipTier.findFirst({
      where: { minPoints: 0 }
    });
    var tierName = defaultTier ? defaultTier.name : "Bronze";

    var newCustomer = await prisma.$transaction(async (tx) => {
      var customer = await tx.customer.create({
        data: {
          phone: phone,
          name: name,
          fullName: name,
          email: phone + '@lh-quick.com',
          source: 'walk-in',
          points: 0,
          tier: tierName
        }
      });

      if (defaultTier) {
        await tx.customerMembership.create({
          data: {
            customerId: customer.id,
            tierId: defaultTier.id,
            totalPoints: 0,
            totalSpent: 0
          }
        });
      }

      return customer;
    });

    // Step 3: Response
    return res.status(201).json({
      success: true,
      message: "Đăng ký khách hàng thành công.",
      data: {
        _id: newCustomer.id,
        name: newCustomer.name,
        phone: newCustomer.phone,
        points: newCustomer.points
      }
    });

  } catch (error) {
    next(error);
  }
}


async function redeemLoyaltyReward(req, res, next) {
  try {
    const customerId = req.params.id;
    const rewardId = req.body.rewardId;

    if (!rewardId) {
      return res.status(400).json({ message: 'rewardId is required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        include: { customerMemberships: true }
      });
      if (!customer || customer.customerMemberships.length === 0) {
        throw { statusCode: 404, message: 'Customer or membership not found' };
      }
      const membership = customer.customerMemberships[0];

      const reward = await tx.loyaltyReward.findUnique({
        where: { id: rewardId }
      });
      if (!reward || !reward.isActive) {
        throw { statusCode: 404, message: 'Reward not found or inactive' };
      }

      if (membership.totalPoints < reward.pointsRequired) {
        throw { statusCode: 400, message: 'Not enough points' };
      }

      const updatedMembership = await tx.customerMembership.update({
        where: { id: membership.id },
        data: { totalPoints: membership.totalPoints - reward.pointsRequired }
      });

      await tx.pointTransaction.create({
        data: {
          customerMembershipId: membership.id,
          type: 'REDEEM',
          points: -reward.pointsRequired,
          note: 'Đổi quà: ' + reward.name
        }
      });

      const code = 'RW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + (reward.expiryDays || 30));

      const voucher = await tx.voucher.create({
        data: {
          name: reward.name,
          requiresCode: true,
          code: code,
          discountValue: reward.discountValue || 0,
          discountType: reward.discountType || 'percent',
          minOrderValue: reward.minOrderValue || 0,
          scope: 'global',
          maxUses: 1,
          usedCount: 0,
          startDate: new Date(),
          expireDate: expireDate,
          isActive: true,
          customerId: customerId,
          loyaltyRewardId: reward.id
        }
      });

      return { voucher, updatedMembership };
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    next(error);
  }
}

async function checkPhoneAuth(req, res, next) {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone is required' });
    }

    const customer = await prisma.customer.findUnique({
      where: { phone: String(phone).trim() }
    });

    if (!customer) {
      return res.json({ status: 'not_found' });
    }

    if (!customer.passwordHash) {
      return res.json({ 
        status: 'no_pin', 
        customer: { id: customer.id, fullName: customer.fullName } 
      });
    }

    return res.json({ 
      status: 'has_pin', 
      customer: { id: customer.id, fullName: customer.fullName } 
    });
  } catch (error) {
    next(error);
  }
}

async function customerLogin(req, res, next) {
  try {
    const { phone, pin, fullName } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ message: 'Phone and PIN are required' });
    }

    const trimmedPhone = String(phone).trim();
    let customer = await prisma.customer.findUnique({
      where: { phone: trimmedPhone }
    });

    if (!customer) {
      // Create new customer
      const hash = await bcrypt.hash(pin, 10);
      customer = await prisma.customer.create({
        data: {
          phone: trimmedPhone,
          fullName: fullName || 'Khách vãng lai',
          passwordHash: hash,
          source: 'customer-app'
        }
      });
      
      // Assign default Bronze membership
      const defaultTier = await prisma.membershipTier.findFirst({
        orderBy: { minPoints: 'asc' }
      });
      
      if (defaultTier) {
        await prisma.customerMembership.create({
          data: {
            customerId: customer.id,
            tierId: defaultTier.id
          }
        });
      }
    } else {
      if (!customer.passwordHash) {
        // Set PIN for existing customer
        const hash = await bcrypt.hash(pin, 10);
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { passwordHash: hash }
        });
      } else {
        // Verify PIN
        const isValid = await bcrypt.compare(pin, customer.passwordHash);
        if (!isValid) {
          return res.status(401).json({ message: 'Mã PIN không đúng' });
        }
      }
    }

    // Now fetch complete profile
    const fullProfile = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: {
        customerMemberships: {
          include: {
            tier: true
          }
        }
      }
    });

    return res.json({
      success: true,
      data: fullProfile
    });
  } catch (error) {
    next(error);
  }
}

async function updateCustomerMembership(req, res, next) {
  try {
    const { id } = req.params;
    const { totalPoints, tierId } = req.body;

    const membership = await prisma.customerMembership.findFirst({
      where: { customerId: id }
    });

    if (!membership) {
      if (tierId) {
        const newMembership = await prisma.customerMembership.create({
          data: {
            customerId: id,
            tierId,
            totalPoints: totalPoints || 0
          },
          include: { tier: true }
        });
        return res.json({ data: newMembership });
      }
      return res.status(404).json({ message: 'Customer membership not found' });
    }

    const updated = await prisma.customerMembership.update({
      where: { id: membership.id },
      data: {
        totalPoints: totalPoints !== undefined ? Number(totalPoints) : undefined,
        tierId: tierId || undefined
      },
      include: { tier: true }
    });

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCustomers: listCustomers,
  getCustomerById: getCustomerById,
  getCustomerDetail: getCustomerDetail,
  getCustomerOrders: getCustomerOrders,
  getCustomerPoints: getCustomerPoints,
  quickRegisterCustomer: quickRegisterCustomer,
  redeemLoyaltyReward: redeemLoyaltyReward,
  checkPhoneAuth: checkPhoneAuth,
  customerLogin: customerLogin,
  updateCustomerMembership: updateCustomerMembership
};

