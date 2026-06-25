var express = require('express');
var loyaltyRoutes = require('./loyalty.routes');
var crmRoutes = require('./crm.routes');

var router = express.Router();

router.use('/loyalty', loyaltyRoutes);
router.use('/crm', crmRoutes);

module.exports = router;
