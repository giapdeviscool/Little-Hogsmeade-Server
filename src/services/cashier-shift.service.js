var cashierShiftRepository = require('../repositories/cashier-shift.repository');
var orderRepository = require('../repositories/order.repository');
var prisma = require('../lib/prisma');

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

async function openShift(branchId, employeeId, payload) {
  if (!branchId || typeof branchId !== 'string') {
    throwHttpError(403, 'BranchId must be provided by authentication token');
  }

  if (!employeeId || typeof employeeId !== 'string') {
    throwHttpError(403, 'EmployeeId must be provided by authentication token');
  }

  var activeShift = await cashierShiftRepository.findActiveCashierShiftByBranch(branchId);
  if (activeShift) {
    throwHttpError(409, 'An active shift already exists for this branch/terminal');
  }

  var startingFloat = parseFloat(payload.starting_float);
  if (isNaN(startingFloat) || startingFloat < 0) {
    throwHttpError(400, 'Invalid starting float amount');
  }

  var shift = await cashierShiftRepository.createCashierShift({
    branchId: branchId,
    employeeId: employeeId,
    startingFloat: startingFloat,
    expectedCashSystem: startingFloat,
    status: 'OPEN',
    openedAt: new Date()
  });

  return {
    shift_id: shift.id,
    status: shift.status,
    starting_float: shift.startingFloat,
    opened_at: shift.openedAt
  };
}

async function checkActiveShift(branchId) {
  var activeShift = await cashierShiftRepository.findActiveCashierShiftByBranch(branchId);
  if (!activeShift) {
    return { active: false };
  }
  return {
    active: true,
    shift_id: activeShift.id,
    opened_at: activeShift.openedAt,
    starting_float: activeShift.startingFloat
  };
}

async function requestClosure(shiftId, branchId) {
  var shift = await cashierShiftRepository.findCashierShiftById(shiftId);
  if (!shift) {
    throwHttpError(404, 'Shift not found');
  }
  if (shift.branchId !== branchId) {
    throwHttpError(403, 'Shift does not belong to your branch');
  }
  if (shift.status !== 'OPEN') {
    throwHttpError(400, 'Shift is not open');
  }

  var pendingOrdersCount = await orderRepository.countPendingOrdersForBranch(shift.branchId);
  
  if (pendingOrdersCount > 0) {
    throwHttpError(409, 'Cannot close shift with pending orders');
  }

  var expectedCash = shift.expectedCashSystem !== null ? shift.expectedCashSystem : shift.startingFloat;
  var cashSales = Math.max(0, expectedCash - shift.startingFloat);

  return {
    expected_cash_system: expectedCash,
    cash_sales: cashSales,
    cash_refunds: 0,
    message: 'Please request the TOTP code from the manager.'
  };
}

async function closeShift(shiftId, branchId, payload, currentUser) {
  var shift = await cashierShiftRepository.findCashierShiftById(shiftId);
  if (!shift) {
    throwHttpError(404, 'Shift not found');
  }
  if (shift.branchId !== branchId) {
    throwHttpError(403, 'Shift does not belong to your branch');
  }
  if (shift.status !== 'OPEN') {
    throwHttpError(400, 'Shift is not open');
  }

  const code = payload.code || payload.otp || payload.pin;

  if (!code || typeof code !== 'string') {
    throwHttpError(400, 'PIN code is required');
  }

  // Verify against the employee's own PIN code
  var employee = await prisma.employee.findUnique({
    where: { id: currentUser.id },
    select: { pinCode: true }
  });
  if (!employee || code !== employee.pinCode) {
    throwHttpError(401, 'Invalid PIN code.');
  }

  var actualCashCounted = parseFloat(payload.actual_cash_counted);
  if (isNaN(actualCashCounted) || actualCashCounted < 0) {
    throwHttpError(400, 'Invalid actual cash count');
  }

  return prisma.$transaction(async function(tx) {
    var pendingOrdersCount = await orderRepository.countPendingOrdersForBranch(shift.branchId, tx);
    
    if (pendingOrdersCount > 0) {
      throwHttpError(409, 'Cannot close shift with pending orders');
    }

    var expectedCash = shift.expectedCashSystem !== null ? shift.expectedCashSystem : shift.startingFloat;
    var discrepancyAmount = actualCashCounted - expectedCash;

    var updatedShift = await cashierShiftRepository.updateCashierShift(shiftId, {
      status: 'CLOSED',
      actualCashCounted: actualCashCounted,
      expectedCashSystem: expectedCash,
      discrepancyAmount: discrepancyAmount,
      closedAt: new Date(),
      authorizedAdminId: currentUser.id
    }, tx);

    return {
      shift: updatedShift
    };
  });
}

module.exports = {
  openShift: openShift,
  checkActiveShift: checkActiveShift,
  requestClosure: requestClosure,
  closeShift: closeShift
};
