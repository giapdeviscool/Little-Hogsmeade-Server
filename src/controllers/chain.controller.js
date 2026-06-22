var chainService = require('../services/chain.service');

async function getDashboard(req, res, next) {
  try {
    var result = await chainService.getDashboard(req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getConfig(req, res, next) {
  try {
    var result = await chainService.getConfig();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function updateConfig(req, res, next) {
  try {
    var result = await chainService.updateConfig(req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function syncMenu(req, res, next) {
  try {
    var result = await chainService.syncMenu();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function updatePricing(req, res, next) {
  try {
    var result = await chainService.updatePricing(req.body, req.user);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function createPromotion(req, res, next) {
  try {
    var result = await chainService.createPromotion(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getPromotions(req, res, next) {
  try {
    var result = await chainService.getPromotions(req.query || {});
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function updatePromotion(req, res, next) {
  try {
    var result = await chainService.updatePromotion(req.params.id, req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function deletePromotion(req, res, next) {
  try {
    var result = await chainService.deletePromotion(req.params.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getMenuSyncPreview(req, res, next) {
  try {
    var result = await chainService.getMenuSyncPreview();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard: getDashboard,
  getConfig: getConfig,
  updateConfig: updateConfig,
  syncMenu: syncMenu,
  updatePricing: updatePricing,
  createPromotion: createPromotion,
  getPromotions: getPromotions,
  updatePromotion: updatePromotion,
  deletePromotion: deletePromotion,
  getMenuSyncPreview: getMenuSyncPreview
};
