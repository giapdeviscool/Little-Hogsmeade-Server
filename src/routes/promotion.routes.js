var express = require('express');
var chainController = require('../controllers/chain.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

router.get('/', chainController.getPromotions);
router.post('/', chainController.createPromotion);

module.exports = router;
