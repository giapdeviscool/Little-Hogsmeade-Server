var express = require('express');
var loyaltyController = require('../controllers/loyalty.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

router.get('/configs', loyaltyController.getConfig);
router.put('/configs', loyaltyController.updateConfig);

router.get('/rewards', loyaltyController.getRewards);
router.post('/rewards', loyaltyController.createReward);
router.put('/rewards/:id', loyaltyController.updateReward);
router.delete('/rewards/:id', loyaltyController.deleteReward);

module.exports = router;
