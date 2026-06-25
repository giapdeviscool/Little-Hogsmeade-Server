var prisma = require('../lib/prisma');
var { authenticator } = require('otplib');
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

  var secret = employee.totpSecret;
  if (!secret) {
    secret = authenticator.generateSecret();
    await prisma.employee.update({
      where: { id: employee.id },
      data: { totpSecret: secret }
    });
  }

  const otpauth = authenticator.keyuri('ChainAdmin', 'Little Hogsmeade', secret);
  const qrCode = await QRCode.toDataURL(otpauth);

  return { qrCode: qrCode, secret: secret };
}

async function verify2FA(userId, code) {
  const employee = await prisma.employee.findUnique({
    where: { id: userId }
  });

  const secret = (employee && employee.totpSecret) || process.env.ADMIN_TOTP_SECRET;
  if (!secret) {
    throwHttpError(400, 'No Admin TOTP secret configured');
  }

  const isValid = authenticator.check(code, secret);
  if (!isValid) {
    throwHttpError(400, 'Invalid or expired Admin OTP token.');
  }

  return { success: true };
}

module.exports = {
  setup2FA: setup2FA,
  verify2FA: verify2FA
};
