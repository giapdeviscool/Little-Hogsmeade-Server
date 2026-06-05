var authService = require('../services/auth.service');
var authRepository = require('../repositories/auth.repository');

async function authenticate(req, res, next) {
  try {
    var authHeader = req.headers.authorization;

    if (!authHeader || authHeader.indexOf('Bearer ') !== 0) {
      return res.status(401).json({ message: 'Missing or invalid authorization header' });
    }

    var payload = authService.verifyToken(authHeader.substring(7));
    req.user = {
      id: payload.sub,
      type: payload.type,
      phone: payload.phone,
      email: payload.email || null,
      branchId: payload.branchId || null,
      roleId: payload.roleId || null,
      roleName: payload.roleName || null
    };

    if (req.user.type === 'employee' && (!req.user.roleName || !req.user.branchId)) {
      var employee = await authRepository.findEmployeeById(req.user.id);

      if (employee) {
        req.user.branchId = employee.branchId;
        req.user.roleId = employee.roleId;
        req.user.roleName = employee.role ? employee.role.name : null;
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireChainRole(req, res, next) {
  if (!req.user || req.user.type !== 'employee') {
    return res.status(403).json({ message: 'Owner or Chain Admin role is required' });
  }

  if (isOwner(req.user) || isChainAdmin(req.user)) {
    return next();
  }

  return res.status(403).json({ message: 'Owner or Chain Admin role is required' });
}

function requireOwner(req, res, next) {
  if (req.user && isOwner(req.user)) {
    return next();
  }

  return res.status(403).json({ message: 'Owner role is required' });
}

function isOwner(user) {
  var roleName = normalizeRoleName(user.roleName);
  return roleName.indexOf('owner') > -1 || roleName.indexOf('chain owner') > -1;
}

function isChainAdmin(user) {
  var roleName = normalizeRoleName(user.roleName);
  return roleName.indexOf('chain admin') > -1 || roleName.indexOf('admin') > -1 || roleName.indexOf('manager') > -1;
}

function normalizeRoleName(roleName) {
  return String(roleName || '').trim().toLowerCase();
}

module.exports = {
  authenticate: authenticate,
  requireChainRole: requireChainRole,
  requireOwner: requireOwner,
  isOwner: isOwner,
  isChainAdmin: isChainAdmin
};
