var express = require('express');
var loyaltyController = require('../controllers/loyalty.controller');
var tierController = require('../controllers/tier.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.verifyRole(['owner', 'chain admin', 'manager']));

router.get('/configs', loyaltyController.getConfig);
router.put('/configs', loyaltyController.updateConfig);

router.get('/rewards', loyaltyController.getRewards);
router.post('/rewards', loyaltyController.createReward);
router.put('/rewards/:id', loyaltyController.updateReward);
router.delete('/rewards/:id', loyaltyController.deleteReward);

router.get('/tiers', tierController.getTiers);
router.post('/tiers', tierController.createTier);
router.put('/tiers/:id', tierController.updateTier);
router.delete('/tiers/:id', tierController.deleteTier);

module.exports = router;
