var express = require('express');
var router = express.Router();
var stocktakeController = require('../controllers/stocktake.controller');
var authMiddleware = require('../middlewares/auth.middleware');

// UC80: Create Stocktake Note
router.post('/', authMiddleware.authenticate, stocktakeController.createStocktakeNote);

// UC81: Get Pending Stocktakes
router.get('/pending', authMiddleware.authenticate, stocktakeController.getPendingStocktakes);

// UC81: Process Stocktake
router.post('/:id/process', authMiddleware.authenticate, stocktakeController.processStocktake);

module.exports = router;
