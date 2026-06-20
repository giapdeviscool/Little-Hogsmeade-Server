var express = require('express');
var authRoutes = require('./auth.routes');
var userRoutes = require('./user.routes');
var branchRoutes = require('./branch.routes');
var chainRoutes = require('./chain.routes');
var promotionRoutes = require('./promotion.routes');
var employeeRoutes = require('./employee.routes');
var shiftRoutes = require('./shift.routes');
var rosterRoutes = require('./roster.routes');
var attendanceRoutes = require('./attendance.routes');
var payrollRoutes = require('./payroll.routes');
//var membershipRoutes = require('./membership.routes');
var categoryRoutes = require('./category.routes');
var menuItemRoutes = require('./menu-item.routes');
var resourcesConfig = require('../config/resources');
var createResourceRouter = require('./resource.routes');

var router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/branches', branchRoutes);
router.use('/chain', chainRoutes);
router.use('/promotions', promotionRoutes);
router.use('/employees', employeeRoutes);
router.use('/shifts', shiftRoutes);
router.use('/rosters', rosterRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/payroll', payrollRoutes);
//router.use('/memberships', membershipRoutes);
router.use('/categories', categoryRoutes);
router.use('/menu-items', menuItemRoutes);

router.get('/resources', function(req, res) {
  res.json({
    data: resourcesConfig.getResources().map(function(resource) {
      return {
        name: resource.name,
        path: '/api/v1/' + resource.path,
        model: resource.model
      };
    })
  });
});

resourcesConfig.getResources().forEach(function(resource) {
  var resourceRouter = createResourceRouter(resource);

  router.use('/' + resource.path, resourceRouter);

  if (resource.name !== resource.path) {
    router.use('/' + resource.name, resourceRouter);
  }
});

module.exports = router;
