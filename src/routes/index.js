var express = require('express');
var authRoutes = require('./auth.routes');
var userRoutes = require('./user.routes');
var resourcesConfig = require('../config/resources');
var createResourceRouter = require('./resource.routes');

var router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

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
