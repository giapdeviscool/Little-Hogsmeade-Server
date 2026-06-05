var express = require('express');
var chainController = require('../controllers/chain.controller');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

router.get('/dashboard', chainController.getDashboard);
router.get('/config', chainController.getConfig);
router.put('/config', authMiddleware.requireOwner, chainController.updateConfig);
router.get('/menu-sync-preview', chainController.getMenuSyncPreview);
router.post('/sync-menu', authMiddleware.requireOwner, chainController.syncMenu);
router.put('/pricing', chainController.updatePricing);

module.exports = router;
