const express = require('express');
const router = express.Router();
const stockConversionController = require('../controllers/stock-conversion.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware.authenticate);

router.post('/', stockConversionController.createConversion);

module.exports = router;
