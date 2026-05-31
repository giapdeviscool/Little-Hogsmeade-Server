var express = require('express');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.json({
    message: 'Little Hogsmeade Server is running',
    api: '/api/v1'
  });
});

module.exports = router;
