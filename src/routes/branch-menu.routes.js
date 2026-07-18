var express = require('express');
var chainService = require('../services/chain.service');
var authMiddleware = require('../middlewares/auth.middleware');

var router = express.Router();

router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireChainRole);

router.get('/:branchId/menu', async function(req, res, next) {
  try {
    var result = await chainService.getBranchMenu(req.params.branchId);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.put('/:branchId/categories', async function(req, res, next) {
  try {
    var result = await chainService.updateBranchMenuCategories(req.params.branchId, req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.put('/:branchId/items', async function(req, res, next) {
  try {
    var result = await chainService.updateBranchMenuItems(req.params.branchId, req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
