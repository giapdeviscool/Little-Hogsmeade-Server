var express = require('express');
var chainController = require('../controllers/chain.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.get('/', chainController.getPromotions);

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager']));

router.post('/', chainController.createPromotion);
router.put('/:id', chainController.updatePromotion);
router.patch('/:id/toggle-status', chainController.togglePromotionStatus);
router.delete('/:id', chainController.deletePromotion);

module.exports = router;
