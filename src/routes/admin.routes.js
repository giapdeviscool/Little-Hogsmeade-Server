var express = require('express');
var authMiddleware = require('../middlewares/auth.middleware');
var loyaltyRoutes = require('./loyalty.routes');
var crmRoutes = require('./crm.routes');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin']));


router.use('/loyalty', loyaltyRoutes);
router.use('/crm', crmRoutes);

module.exports = router;
