const stockConversionService = require('../services/stock-conversion.service');

exports.createConversion = async (req, res, next) => {
  try {
    const { preparationId, yieldQuantity } = req.body;
    
    if (!preparationId || yieldQuantity === undefined) {
      return res.status(400).json({ success: false, message: 'preparationId and yieldQuantity are required' });
    }

    const transaction = await stockConversionService.convertStock(
      req.user.branchId, 
      req.user.id, 
      preparationId, 
      Number(yieldQuantity)
    );

    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Stock conversion successful'
    });
  } catch (err) {
    next(err);
  }
};
