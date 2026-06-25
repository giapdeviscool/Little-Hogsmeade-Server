var paymentRepository = require('../repositories/payment.repository');
var prisma = require('../lib/prisma');

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

async function createQrIntent(payload) {
  var invoiceId = payload.invoice_id;
  var amount = parseFloat(payload.amount);

  if (!invoiceId || isNaN(amount) || amount <= 0) {
    throwHttpError(400, 'Invalid invoice_id or amount');
  }

  var invoice = await paymentRepository.findInvoiceById(invoiceId);
  if (!invoice) {
    throwHttpError(404, 'Invoice not found');
  }

  // Generate a unique alphanumeric reference string (LH + last 6 chars of invoice_id)
  var referenceString = 'LH' + invoiceId.substring(invoiceId.length - 6).toUpperCase() + 'D1';

  var bankId = process.env.SEPAY_MERCHANT_BANK || process.env.MERCHANT_BANK_ID || 'MB';
  var accountNo = process.env.SEPAY_MERCHANT_ACC || process.env.MERCHANT_BANK_ACCOUNT || '0868112005';
  var template = process.env.SEPAY_TEMPLATE || 'compact2';
  var rawHolder = process.env.SEPAY_MERCHANT_HOLDER || 'NGUYEN THI MINH ANH';
  var showInfo = process.env.SHOW_INFO || 'true';

  // Sanitize the holder name by removing any leaked quotation marks and trimming whitespace
  var cleanHolder = rawHolder.replace(/['"]/g, '').trim();
  var holder = encodeURIComponent(cleanHolder);
  var des = encodeURIComponent(referenceString);

  // Construct target URL using SePay template string format
  var qrCodeUrl = `https://qr.sepay.vn/img?acc=${accountNo}&bank=${bankId}&amount=${amount}&des=${des}&template=${template}&showinfo=${showInfo}&holder=${holder}`;

  // Create payment record with pending status
  var payment = await paymentRepository.createPayment({
    invoiceId: invoiceId,
    method: 'vietqr',
    amount: amount,
    transactionRef: referenceString,
    qrCodeUrl: qrCodeUrl,
    status: 'pending'
  });

  return payment;
}

async function cashSettle(payload) {
  var invoiceId = payload.invoice_id;
  var cashReceived = parseFloat(payload.cash_received);

  if (!invoiceId || isNaN(cashReceived) || cashReceived < 0) {
    throwHttpError(400, 'Invalid invoice_id or cash_received');
  }

  return prisma.$transaction(async function(tx) {
    var invoice = await paymentRepository.findInvoiceById(invoiceId, tx);
    if (!invoice) {
      throwHttpError(404, 'Invoice not found');
    }

    var cashChangeDue = cashReceived - invoice.totalAmount;
    if (cashChangeDue < 0) {
      throwHttpError(400, 'Insufficient cash received');
    }

    // Create the successful payment record
    var payment = await paymentRepository.createPayment({
      invoiceId: invoiceId,
      method: 'cash',
      amount: invoice.totalAmount,
      cashReceived: cashReceived,
      cashChangeDue: cashChangeDue,
      status: 'success',
      paidAt: new Date()
    }, tx);

    // Update invoice & order status
    await paymentRepository.updateInvoiceStatus(invoiceId, 'paid', tx);
    await paymentRepository.updateOrderStatus(invoice.orderId, 'paid', tx);

    // Execute Live Ledger Tracking: Increment cashier shift expected cash
    var activeShift = await paymentRepository.findActiveShiftByBranch(invoice.order.branchId, tx);
    if (activeShift) {
      await paymentRepository.incrementShiftExpectedCash(activeShift.id, invoice.totalAmount, tx);
    }

    // Process customer loyalty points
    await processLoyaltyPoints(tx, invoice.order, invoice);

    return {
      payment: payment,
      change_due: cashChangeDue
    };
  });
}

async function bankWebhook(incomingToken, payload) {
  var secretKey = process.env.WEBHOOK_SECRET_KEY || 'test-secret';
  if (!incomingToken || incomingToken !== secretKey) {
    throwHttpError(401, 'Unauthorized');
  }

  // Extract reference and amount from payload
  var transactionRef = payload.transaction_ref || payload.description || payload.reference || payload.addInfo;
  var receivedAmount = parseFloat(payload.amount || payload.value || payload.transferAmount);

  if (!transactionRef || isNaN(receivedAmount)) {
    throwHttpError(400, 'Missing transaction reference or amount in webhook body');
  }

  // Clean transactionRef (ensure it matches regex by extracting the LH prefix segment if embedded)
  var match = transactionRef.match(/LH[A-Z0-9]{6}/i);
  if (match) {
    transactionRef = match[0].toUpperCase();
  }

  var pendingPayment = await paymentRepository.findPendingPaymentByRef(transactionRef);
  if (!pendingPayment) {
    throwHttpError(404, 'Pending payment not found for reference: ' + transactionRef);
  }

  // Validate amount
  if (receivedAmount !== pendingPayment.amount) {
    // Flag payment as failed
    await paymentRepository.updatePaymentStatus(pendingPayment.id, 'failed', null);
    throwHttpError(400, `Payment amount mismatch. Expected: ${pendingPayment.amount}, Received: ${receivedAmount}`);
  }

  var invoice = pendingPayment.invoice;

  return prisma.$transaction(async function(tx) {
    // Switch statuses to success/paid
    var updatedPayment = await paymentRepository.updatePaymentStatus(pendingPayment.id, 'success', new Date(), tx);
    await paymentRepository.updateInvoiceStatus(invoice.id, 'paid', tx);
    await paymentRepository.updateOrderStatus(invoice.orderId, 'paid', tx);

    // Update loyalty balances
    await processLoyaltyPoints(tx, invoice.order, invoice);

    // Broadcast socket event
    if (global.io) {
      global.io.emit(`payment_success_${invoice.id}`, {
        success: true,
        invoice_id: invoice.id,
        amount: receivedAmount
      });
    }

    return {
      success: true,
      payment: updatedPayment
    };
  });
}

async function processLoyaltyPoints(tx, order, invoice) {
  if (!order.customerId) return;

  var loyaltyConfig = await paymentRepository.findLoyaltyConfigByBranch(order.branchId, tx);
  if (loyaltyConfig && loyaltyConfig.spendPerPoint > 0) {
    var pointsEarned = Math.floor(invoice.totalAmount / loyaltyConfig.spendPerPoint);

    await paymentRepository.updateInvoicePoints(invoice.id, pointsEarned, tx);

    var membership = await paymentRepository.findCustomerMembershipByCustomerId(order.customerId, tx);
    if (!membership) {
      var defaultTier = await tx.membershipTier.findFirst({
        where: { minPoints: 0 }
      });
      if (!defaultTier) {
        throwHttpError(500, 'Default membership tier (minPoints: 0) not found in system');
      }
      membership = await paymentRepository.createCustomerMembership({
        customerId: order.customerId,
        tierId: defaultTier.id,
        totalPoints: 0,
        totalSpent: 0
      }, tx);
    }

    var updatedMembership = await paymentRepository.updateCustomerMembership(membership.id, {
      totalPoints: membership.totalPoints + pointsEarned,
      totalSpent: membership.totalSpent + invoice.totalAmount
    }, tx);

    await paymentRepository.createPointTransaction({
      customerMembershipId: updatedMembership.id,
      orderId: order.id,
      type: 'earn',
      points: pointsEarned,
      note: 'Loyalty points earned for paid order'
    }, tx);
  }
}

module.exports = {
  createQrIntent: createQrIntent,
  cashSettle: cashSettle,
  bankWebhook: bankWebhook
};
