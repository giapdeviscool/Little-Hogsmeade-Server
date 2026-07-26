var prisma = require('../lib/prisma');
var { generateSecret, generateURI, verifySync } = require('otplib');
var QRCode = require('qrcode');

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

async function setup2FA(userId) {
  const employee = await prisma.employee.findUnique({
    where: { id: userId }
  });

  if (!employee) {
    throwHttpError(404, 'Employee not found');
  }

  // Always generate a new secret for setup/re-setup
  var secret = generateSecret();
  await prisma.employee.update({
    where: { id: employee.id },
    data: { tempTotpSecret: secret }
  });

  const otpauth = generateURI({ secret: secret, label: employee.email, issuer: 'Little Hogsmeade' });
  const qrCode = await QRCode.toDataURL(otpauth);

  return { qrCode: qrCode, secret: secret };
}

async function verify2FA(userId, code) {
  const employee = await prisma.employee.findUnique({
    where: { id: userId }
  });

  if (!employee) {
    throwHttpError(404, 'Employee not found');
  }

  // 1. If tempTotpSecret exists, try to verify and promote it
  if (employee.tempTotpSecret) {
    const verification = verifySync({ token: code, secret: employee.tempTotpSecret });
    const isValid = verification && verification.valid;
    if (isValid) {
      await prisma.employee.update({
        where: { id: userId },
        data: {
          totpSecret: employee.tempTotpSecret,
          tempTotpSecret: null
        }
      });
      return { success: true };
    }
  }

  // 2. Determine secret: check user's active secret, first branch admin's active secret, or fallback to env variable
  let secret = employee.totpSecret;

  if (!secret && employee.branchId) {
    const branchAdmin = await prisma.employee.findFirst({
      where: {
        branchId: employee.branchId,
        id: { not: employee.id },
        totpSecret: { not: null }
      }
    });
    if (branchAdmin) {
      secret = branchAdmin.totpSecret;
    }
  }

  secret = secret || process.env.ADMIN_TOTP_SECRET;

  if (!secret) {
    throwHttpError(400, 'No Admin TOTP secret configured');
  }

  const verification = verifySync({ token: code, secret: secret });
  const isValid = verification && verification.valid;
  if (!isValid) {
    throwHttpError(400, 'Invalid or expired Admin OTP token.');
  }

  return { success: true };
}

async function get2FAStatus(userId, targetEmployeeId) {
  var idToCheck = targetEmployeeId || userId;
  const employee = await prisma.employee.findUnique({
    where: { id: idToCheck },
    select: { id: true, totpSecret: true, branchId: true }
  });

  if (!employee) {
    throwHttpError(404, 'Employee not found');
  }

  var hasPersonalSecret = Boolean(employee.totpSecret);

  var hasBranchAdminSecret = false;
  if (employee.branchId) {
    const branchAdmin = await prisma.employee.findFirst({
      where: {
        branchId: employee.branchId,
        totpSecret: { not: null }
      }
    });
    if (branchAdmin) {
      hasBranchAdminSecret = true;
    }
  }

  var hasGlobalAdminSecret = Boolean(process.env.ADMIN_TOTP_SECRET);

  return {
    employeeId: idToCheck,
    has2FA: hasPersonalSecret,
    hasPersonalSecret: hasPersonalSecret,
    hasBranchAdminSecret: hasBranchAdminSecret,
    hasGlobalAdminSecret: hasGlobalAdminSecret,
    is2FAAvailable: hasPersonalSecret || hasBranchAdminSecret || hasGlobalAdminSecret
  };
}

module.exports = {
  setup2FA: setup2FA,
  verify2FA: verify2FA,
  get2FAStatus: get2FAStatus
};

