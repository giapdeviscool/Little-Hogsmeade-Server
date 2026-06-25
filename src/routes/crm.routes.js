var express = require('express');
var crmController = require('../controllers/crm.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

router.get('/customers', crmController.getCustomers);

module.exports = router;
