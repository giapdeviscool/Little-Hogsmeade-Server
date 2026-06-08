var employeeService = require('../services/employee.service');

async function getEmployees(req, res, next) {
  try {
    var result = await employeeService.getEmployees(req.query || {}, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function createEmployee(req, res, next) {
  try {
    var result = await employeeService.createEmployee(req.body, req.user);
    res.status(201).json({
      data: result.employee,
      generatedPin: result.generatedPin,
      message: 'Employee profile created successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function updateEmployee(req, res, next) {
  try {
    var employee = await employeeService.updateEmployee(req.params.id, req.body, req.user);
    res.json({
      data: employee,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEmployees: getEmployees,
  createEmployee: createEmployee,
  updateEmployee: updateEmployee
};
