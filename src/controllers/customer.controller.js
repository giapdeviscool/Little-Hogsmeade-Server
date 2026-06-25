var crmCustomerService = require('../services/crm-customer.service');
var authMiddleware = require('../middlewares/auth.middleware');

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

module.exports = {
  listCustomers: listCustomers,
  getCustomerById: getCustomerById,
  getCustomerDetail: getCustomerDetail,
  getCustomerOrders: getCustomerOrders,
  getCustomerPoints: getCustomerPoints
};
