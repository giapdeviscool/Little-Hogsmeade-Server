var prisma = require('../lib/prisma');

async function handleSePayWebhook(req, res, next) {
  try {
    var payload = req.body;
    var content = payload.content || '';
    
    // Parse the bank transfer description using Regex to extract LH prefix reference
    var match = content.match(/LH([A-F0-9]+)/i);
    if (!match) {
      return res.status(200).json({ success: true, message: 'Ignored: Order reference format matching LH prefix was not found' });
    }

    var transactionRef = match[0].toUpperCase();
    var receivedAmount = parseFloat(payload.transferAmount || payload.amount);

    if (isNaN(receivedAmount)) {
      return res.status(400).json({ error: 'Invalid transfer amount' });
    }

    // Find pending payment matching transactionRef
    var pendingPayment = await prisma.payment.findFirst({
      where: {
        transactionRef: transactionRef,
        status: 'pending'
      },
      include: {
        invoice: {
          include: {
            order: true
          }
        }
      }
    });

    if (!pendingPayment) {
      return res.status(200).json({ success: true, message: 'Ignored: Pending payment record not found for: ' + transactionRef });
    }

    // Verify transaction amount matches expectations
    if (receivedAmount !== pendingPayment.amount) {
      // Flag payment as failed
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: 'failed' }
      });
      return res.status(200).json({ success: true, message: 'Ignored: Payment amount mismatch. Expected ' + pendingPayment.amount });
    }

    var invoice = pendingPayment.invoice;
    var order = invoice.order;

    // Execute atomic db transaction to switch statuses
    await prisma.$transaction(async function(tx) {
      await tx.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: 'success',
          paidAt: new Date()
        }
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'paid' }
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'paid' }
      });

      // Handle customer loyalty points
      if (order.customerId) {
        var loyaltyConfig = await tx.loyaltyConfig.findFirst({
          where: {
            branchId: order.branchId,
            isActive: true
          }
        });

        if (loyaltyConfig && loyaltyConfig.spendPerPoint > 0) {
          var pointsEarned = Math.floor(invoice.totalAmount / loyaltyConfig.spendPerPoint);

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { pointsEarned: pointsEarned }
          });

          var membership = await tx.customerMembership.findFirst({
            where: { customerId: order.customerId }
          });

          if (!membership) {
            var defaultTier = await tx.membershipTier.findFirst({
              where: { minPoints: 0 }
            });
            if (!defaultTier) {
              throw new Error('Default membership tier (minPoints: 0) not found in system');
            }
            membership = await tx.customerMembership.create({
              data: {
                customerId: order.customerId,
                tierId: defaultTier.id,
                totalPoints: 0,
                totalSpent: 0
              }
            });
          }

          var updatedMembership = await tx.customerMembership.update({
            where: { id: membership.id },
            data: {
              totalPoints: membership.totalPoints + pointsEarned,
              totalSpent: membership.totalSpent + invoice.totalAmount
            }
          });

          await tx.pointTransaction.create({
            data: {
              customerMembershipId: updatedMembership.id,
              orderId: order.id,
              type: 'earn',
              points: pointsEarned,
              note: 'Loyalty points earned for paid order'
            }
          });
        }
      }
    });

    // Dispatch WebSocket event to frontend to dismiss checkout modal
    if (global.io) {
      global.io.emit(`payment_success_${invoice.id}`, {
        success: true,
        invoice_id: invoice.id,
        amount: receivedAmount
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleSePayWebhook: handleSePayWebhook
};
