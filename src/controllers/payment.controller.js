var paymentService = require('../services/payment.service');

async function createQrIntent(req, res, next) {
  try {
    var result = await paymentService.createQrIntent(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function cashSettle(req, res, next) {
  try {
    var result = await paymentService.cashSettle(req.body);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function bankWebhook(req, res, next) {
  try {
    var incomingToken = req.headers['x-webhook-token'] || req.headers['authorization'];
    if (incomingToken && incomingToken.startsWith('Bearer ')) {
      incomingToken = incomingToken.substring(7);
    }
    var result = await paymentService.bankWebhook(incomingToken, req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createQrIntent: createQrIntent,
  cashSettle: cashSettle,
  bankWebhook: bankWebhook
};
