var shiftService = require('../services/shift.service');
var prisma = require('../lib/prisma');
var orderRepository = require('../repositories/order.repository');
var { authenticator } = require('otplib');

async function getShifts(req, res, next) {
  try {
    var shifts = await shiftService.getShifts(req.query, req.user);
    res.json({ data: shifts });
  } catch (error) {
    next(error);
  }
}

async function createShift(req, res, next) {
  try {
    var shift = await shiftService.createShift(req.body, req.user);
    res.status(201).json({
      data: shift,
      message: 'Shift Saved Successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function updateShift(req, res, next) {
  try {
    var shift = await shiftService.updateShift(req.params.id, req.body, req.user);
    res.json({
      data: shift,
      message: 'Shift Updated Successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function deleteShift(req, res, next) {
  try {
    var result = await shiftService.deleteShift(req.params.id, req.user);
    res.json({
      data: result.shift,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
}

async function requestClosure(req, res, next) {
  try {
    const shiftId = req.body.shiftId;
    const actualCashCounted = parseFloat(req.body.actualCashCounted !== undefined ? req.body.actualCashCounted : req.body.actualCashCount);

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    if (isNaN(actualCashCounted) || actualCashCounted < 0) {
      return res.status(400).json({ error: 'Invalid actual cash count' });
    }

    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId }
    });

    if (!shift) {
      return res.status(404).json({ error: 'Cashier shift not found' });
    }

    if (shift.status !== 'OPEN') {
      return res.status(400).json({ error: 'Shift is not open' });
    }

    // Business Rule BR-52
    var pendingOrders = await prisma.order.findMany({
      where: {
        cashierShiftId: shiftId,
        status: { in: ['pending', 'PENDING'] }
      }
    });

    var unpaidInvoices = await prisma.invoice.findMany({
      where: {
        order: {
          cashierShiftId: shiftId
        },
        status: { in: ['unpaid', 'UNPAID'] }
      }
    });

    if (pendingOrders.length > 0 || unpaidInvoices.length > 0) {
      return res.status(400).json({ error: "Please complete or void all pending orders before closing the shift." });
    }

    // Aggregate transaction matrix
    var aggregation = await orderRepository.calculateCashRevenueForShift(shiftId);
    var expectedCash = shift.startingFloat + aggregation.cashSales - aggregation.cashRefunds;
    var discrepancy = actualCashCounted - expectedCash;

    // Cache computed parameters
    global.pendingClosures = global.pendingClosures || new Map();
    global.pendingClosures.set(shiftId, {
      actualCashCounted: actualCashCounted,
      expectedCashSystem: expectedCash,
      discrepancyAmount: discrepancy
    });

    return res.status(200).json({
      success: true,
      message: 'Pre-verification successful. Please verify with the 6-digit TOTP code.'
    });
  } catch (error) {
    next(error);
  }
}

async function finalizeClosure(req, res, next) {
  try {
    const shiftId = req.body.shiftId;
    const actualCashCounted = parseFloat(req.body.actualCashCounted !== undefined ? req.body.actualCashCounted : req.body.actualCashCount);
    const code = req.body.code;

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    if (isNaN(actualCashCounted) || actualCashCounted < 0) {
      return res.status(400).json({ error: 'Invalid actual cash count' });
    }

    if (!code) {
      return res.status(400).json({ error: 'TOTP code is required' });
    }

    // Cryptographic verification loop
    const admin = await prisma.employee.findUnique({
      where: { id: req.user.id }
    });

    const secret = (admin && admin.totpSecret) || process.env.ADMIN_TOTP_SECRET;
    if (!secret) {
      return res.status(400).json({ error: 'No Admin TOTP secret configured' });
    }

    const isValid = authenticator.check(code, secret);
    if (!isValid) {
      return res.status(400).json({ error: "Invalid or expired Admin OTP token." });
    }

    // Retrieve cached calculations or fall back to computing them
    global.pendingClosures = global.pendingClosures || new Map();
    var cached = global.pendingClosures.get(shiftId) || {};
    var expectedCash = cached.expectedCashSystem;
    var discrepancy = cached.discrepancyAmount;

    // If cache missed, run calculations
    if (expectedCash === undefined) {
      const shift = await prisma.cashierShift.findUnique({
        where: { id: shiftId }
      });
      if (!shift) {
        return res.status(404).json({ error: 'Shift not found' });
      }
      var aggregation = await orderRepository.calculateCashRevenueForShift(shiftId);
      expectedCash = shift.startingFloat + aggregation.cashSales - aggregation.cashRefunds;
      discrepancy = actualCashCounted - expectedCash;
    }

    // Atomic transaction settlement
    const updatedShift = await prisma.$transaction(async function(tx) {
      // 1. Verify shift is still open
      const shiftDoc = await tx.cashierShift.findUnique({
        where: { id: shiftId }
      });
      if (shiftDoc.status !== 'OPEN') {
        throw new Error('Shift is not open');
      }

      // 2. Perform closure update
      return tx.cashierShift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          actualCashCounted: actualCashCounted,
          expectedCashSystem: expectedCash,
          discrepancyAmount: discrepancy,
          closedAt: new Date(),
          authorizedAdminId: req.user.id
        },
        include: {
          employee: {
            select: { fullName: true, phone: true }
          },
          authorizedAdmin: {
            select: { fullName: true, phone: true }
          },
          branch: true
        }
      });
    });

    // Clean cache
    global.pendingClosures.delete(shiftId);

    // Fetch invoices and orders in this shift to return printer receipt data arrays
    const invoices = await prisma.invoice.findMany({
      where: {
        order: {
          cashierShiftId: shiftId
        }
      },
      include: {
        payments: true
      }
    });

    const orders = await prisma.order.findMany({
      where: {
        cashierShiftId: shiftId
      },
      include: {
        orderItems: {
          include: {
            menuItem: true
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        shift: updatedShift,
        summary: {
          startingFloat: updatedShift.startingFloat,
          actualCashCounted: actualCashCounted,
          expectedCashSystem: expectedCash,
          discrepancyAmount: discrepancy,
          closedAt: updatedShift.closedAt
        },
        invoices: invoices,
        orders: orders
      }
    });
  } catch (error) {
    if (error.message === 'Shift is not open') {
      return res.status(400).json({ error: 'Shift is not open' });
    }
    next(error);
  }
}

async function getReconciliation(req, res, next) {
  try {
    const shiftId = req.params.shiftId;

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        employee: {
          include: {
            role: true
          }
        }
      }
    });

    if (!shift) {
      return res.status(404).json({ error: 'Cashier shift not found' });
    }

    var aggregation = await orderRepository.calculateCashRevenueForShift(shiftId);

    const totalInvoices = await prisma.invoice.count({
      where: {
        order: {
          cashierShiftId: shiftId
        }
      }
    });

    const refundedInvoices = await prisma.invoice.count({
      where: {
        order: {
          cashierShiftId: shiftId
        },
        status: { in: ['refunded', 'REFUNDED'] }
      }
    });

    const expectedCashSystem = shift.startingFloat + aggregation.cashSales - aggregation.cashRefunds;

    return res.status(200).json({
      success: true,
      data: {
        shiftId: shift.id,
        terminal: "#01",
        openedAt: shift.openedAt,
        startingFloat: shift.startingFloat,
        employee: {
          fullName: shift.employee.fullName,
          role: shift.employee.role ? shift.employee.role.name : "Nhân viên phục vụ"
        },
        expectedCashSystem: expectedCashSystem,
        cashSales: aggregation.cashSales,
        cashRefunds: aggregation.cashRefunds,
        totalInvoices: totalInvoices,
        refundedInvoices: refundedInvoices
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getShifts: getShifts,
  createShift: createShift,
  updateShift: updateShift,
  deleteShift: deleteShift,
  requestClosure: requestClosure,
  finalizeClosure: finalizeClosure,
  getReconciliation: getReconciliation
};
