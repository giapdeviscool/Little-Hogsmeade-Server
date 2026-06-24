var crypto = require('crypto');

function sepayAuth(req, res, next) {
  var signature = req.headers['x-sepay-signature'];
  var timestamp = req.headers['x-sepay-timestamp'];
  var secret = process.env.SEPAY_WEBHOOK_SECRET;

  if (!signature || !timestamp || !secret) {
    return res.status(401).send('Invalid signature');
  }

  // Construct verification string layout: string_to_sign = timestamp + '.' + JSON.stringify(req.body)
  var stringToSign = timestamp + '.' + JSON.stringify(req.body);

  // Compute HMAC-SHA256 expected signature
  var computedHex = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex');

  var expectedSignature = 'sha256=' + computedHex;

  // Time-constant comparison to prevent timing attacks
  var sigBuffer = Buffer.from(signature);
  var expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return res.status(401).send('Invalid signature');
  }

  try {
    var isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    if (!isValid) {
      return res.status(401).send('Invalid signature');
    }
  } catch (error) {
    return res.status(401).send('Invalid signature');
  }

  next();
}

module.exports = sepayAuth;
