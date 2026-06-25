var crmCustomerService = require('../services/crm-customer.service');
var authMiddleware = require('../middlewares/auth.middleware');
var prisma = require('../lib/prisma');

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

module.exports = {
  listCustomers: listCustomers,
  getCustomerById: getCustomerById,
  getCustomerDetail: getCustomerDetail,
  getCustomerOrders: getCustomerOrders,
  getCustomerPoints: getCustomerPoints,
  quickRegisterCustomer: quickRegisterCustomer
};
