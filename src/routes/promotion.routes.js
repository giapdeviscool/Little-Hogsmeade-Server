var express = require('express');
var chainController = require('../controllers/chain.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.get('/', chainController.getPromotions);

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

router.post('/', chainController.createPromotion);
router.patch('/:id', chainController.updatePromotion);
router.delete('/:id', chainController.deletePromotion);

module.exports = router;
