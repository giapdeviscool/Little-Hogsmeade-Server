var stocktakeService = require('../services/stocktake.service');

async function createStocktakeNote(req, res, next) {
  try {
    var result = await stocktakeService.createStocktakeNote(req.body, req.user);
    res.status(201).json({
      data: result,
      message: 'Stocktake Note created successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function getPendingStocktakes(req, res, next) {
  try {
    var branchId = req.query.branchId;
    var result = await stocktakeService.getPendingStocktakes(branchId, req.user);
    res.status(200).json({
      data: result,
      message: 'Pending stocktakes retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
}

async function processStocktake(req, res, next) {
  try {
    var noteId = req.params.id;
    var action = req.body.action; // 'APPROVE' or 'REJECT'
    var result = await stocktakeService.processStocktake(noteId, action, req.user);
    res.status(200).json({
      data: result,
      message: 'Stocktake processed successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createStocktakeNote: createStocktakeNote,
  getPendingStocktakes: getPendingStocktakes,
  processStocktake: processStocktake
};
