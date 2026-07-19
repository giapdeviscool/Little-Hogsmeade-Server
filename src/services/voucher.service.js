var { PrismaClient } = require('@prisma/client');
var prisma = new PrismaClient();

async function validateVoucher(code, orderSubtotal, customerId, branchId) {
  var voucher = await prisma.voucher.findUnique({
    where: { code: code }
  });

  if (!voucher) {
    throw new Error('Mã Voucher không tồn tại.');
  }

  if (!voucher.isActive) {
    throw new Error('Mã Voucher này hiện không hoạt động.');
  }

  var now = new Date();
  if (now < voucher.startDate) {
    throw new Error('Mã Voucher này chưa đến thời gian sử dụng.');
  }

  if (now > voucher.expireDate) {
    throw new Error('Mã Voucher này đã hết hạn sử dụng.');
  }

  if (voucher.usedCount >= voucher.maxUses) {
    throw new Error('Mã Voucher này đã hết lượt sử dụng.');
  }

  if (voucher.minOrderValue && orderSubtotal < voucher.minOrderValue) {
    throw new Error(`Đơn hàng phải đạt tối thiểu ${voucher.minOrderValue.toLocaleString('vi-VN')}₫ để áp dụng mã này.`);
  }

  // If voucher has specific customer assigned
  if (voucher.customerId && customerId) {
    if (voucher.customerId !== customerId) {
      throw new Error('Mã Voucher này không thuộc về khách hàng hiện tại.');
    }
  }

  // If it's scoped to specific branches
  if (voucher.scope === 'specific' && voucher.appliedBranches && voucher.appliedBranches.length > 0) {
    if (branchId && !voucher.appliedBranches.includes(branchId)) {
      throw new Error('Mã Voucher này không áp dụng cho cơ sở hiện tại.');
    }
  }

  var discountAmount = 0;
  if (voucher.discountType === 'percent') {
    discountAmount = orderSubtotal * (voucher.discountValue / 100);
  } else if (voucher.discountType === 'fixed') {
    discountAmount = voucher.discountValue;
  }

  // Discount shouldn't exceed subtotal
  if (discountAmount > orderSubtotal) {
    discountAmount = orderSubtotal;
  }

  return {
    isValid: true,
    voucher: voucher,
    discountAmount: discountAmount
  };
}

async function getCustomerVouchers(customerId) {
  var now = new Date();
  var vouchers = await prisma.voucher.findMany({
    where: {
      customerId: customerId,
      isActive: true,
      usedCount: { lt: prisma.voucher.fields.maxUses },
      startDate: { lte: now },
      expireDate: { gte: now }
    },
    orderBy: { expireDate: 'asc' }
  });
  return vouchers;
}

module.exports = {
  validateVoucher,
  getCustomerVouchers
};
