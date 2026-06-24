var express = require('express');
var loyaltyRoutes = require('./loyalty.routes');

var router = express.Router();

router.use('/loyalty', loyaltyRoutes);

module.exports = router;
