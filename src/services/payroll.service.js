var payrollRepository = require('../repositories/payroll.repository');
var authMiddleware = require('../middlewares/auth.middleware');

// Standard working hours per month (for salary calculation)
var STANDARD_HOURS_PER_MONTH = 176; // 22 days × 8 hours

// ──────────────────────────────────────────────
// UC62 – View payroll data
// ──────────────────────────────────────────────

async function getPayroll(query, currentUser) {
  // Parse month (format: "2026-06")
  var monthRange = parseMonthRange(query.month);

  var options = {
    monthStart: monthRange.start,
    monthEnd: monthRange.end
  };

  // BR-HR33: Staff/Cashier see only their own salary
  if (!authMiddleware.isOwner(currentUser) && !authMiddleware.isChainAdmin(currentUser)) {
    options.employeeId = currentUser.id;
  } else {
    // BR-HR35: Chain Admin restricted to their branch
    if (authMiddleware.isChainAdmin(currentUser)) {
      options.branchId = currentUser.branchId;
    } else if (query.branchId) {
      assertValidObjectId(query.branchId, 'branchId');
      options.branchId = query.branchId;
    }

    if (query.employeeId) {
      assertValidObjectId(query.employeeId, 'employeeId');
      options.employeeId = query.employeeId;
    }
  }

  // Get all timesheets for the period
  var timesheets = await payrollRepository.findTimesheets(options);

  // Get all employees for context
  var employeeOptions = {};
  if (options.employeeId) employeeOptions.employeeId = options.employeeId;
  if (options.branchId) employeeOptions.branchId = options.branchId;
  var employees = await payrollRepository.findEmployeesForPayroll(employeeOptions);

  // BR-HR34: Dynamic calculation
  var payrollSummaries = calculatePayrollSummaries(employees, timesheets);

  return payrollSummaries;
}

// ──────────────────────────────────────────────
// BR-HR34: Dynamic Calculation Protocol
// ──────────────────────────────────────────────

function calculatePayrollSummaries(employees, timesheets) {
  // Group timesheets by employeeId
  var timesheetMap = {};
  for (var i = 0; i < timesheets.length; i++) {
    var ts = timesheets[i];
    if (!timesheetMap[ts.employeeId]) {
      timesheetMap[ts.employeeId] = [];
    }
    timesheetMap[ts.employeeId].push(ts);
  }

  var summaries = [];

  for (var j = 0; j < employees.length; j++) {
    var emp = employees[j];
    var empTimesheets = timesheetMap[emp.id] || [];

    var totalWorkedHours = 0;
    var totalDays = 0;
    var lateArrivals = 0;
    var autoClosedSessions = 0;
    var dailyDetails = [];

    for (var k = 0; k < empTimesheets.length; k++) {
      var record = empTimesheets[k];

      if (record.checkIn && record.checkOut) {
        var workedMs = new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime();
        var workedHours = workedMs / (1000 * 60 * 60);
        totalWorkedHours += workedHours;
        totalDays++;

        dailyDetails.push({
          date: record.date,
          checkIn: record.checkIn,
          checkOut: record.checkOut,
          workedHours: Math.round(workedHours * 100) / 100,
          shiftName: record.shift ? record.shift.name : null,
          note: record.note
        });

        // Flag late arrivals / auto-closed
        if (record.note && record.note.indexOf('Auto-Closed') > -1) {
          autoClosedSessions++;
        }
        if (record.note && record.note.indexOf('Late') > -1) {
          lateArrivals++;
        }
      } else if (record.checkIn && !record.checkOut) {
        // Open session (not yet checked out)
        totalDays++;
        dailyDetails.push({
          date: record.date,
          checkIn: record.checkIn,
          checkOut: null,
          workedHours: 0,
          shiftName: record.shift ? record.shift.name : null,
          note: 'Session still open'
        });
      }
    }

    var baseSalary = emp.baseSalary || 0;
    var hourlyRate = baseSalary / STANDARD_HOURS_PER_MONTH;
    var estimatedSalary = Math.round(hourlyRate * totalWorkedHours);

    summaries.push({
      employeeId: emp.id,
      employeeName: emp.fullName,
      branchId: emp.branchId,
      branchName: emp.branch ? emp.branch.name : null,
      roleName: emp.role ? emp.role.name : null,
      employeeType: emp.employeeType || 'full_time',
      baseSalary: baseSalary,
      totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
      totalDays: totalDays,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      estimatedSalary: estimatedSalary,
      lateArrivals: lateArrivals,
      autoClosedSessions: autoClosedSessions,
      dailyDetails: dailyDetails
    });
  }

  return summaries;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function parseMonthRange(monthStr) {
  if (!monthStr) {
    // Default to current month
    var now = new Date();
    monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  var parts = monthStr.split('-');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed

  if (isNaN(year) || isNaN(month)) {
    throwHttpError(400, 'Invalid month format. Use YYYY-MM (e.g., 2026-06)');
  }

  var start = new Date(year, month, 1, 0, 0, 0, 0);
  var end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of month

  return { start: start, end: end };
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function assertValidObjectId(value, fieldName) {
  if (!value || typeof value !== 'string' || value.length !== 24) {
    throwHttpError(400, 'Invalid ' + fieldName + ': must be a 24-character ObjectId');
  }
}

module.exports = {
  getPayroll: getPayroll
};
