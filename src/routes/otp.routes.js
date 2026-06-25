var express = require('express');
var otpController = require('../controllers/otp.controller');
var authMiddleware = require('../middlewares/auth.middleware');
var validate = require('../middlewares/validate.middleware');
var otpValidator = require('../validators/otp.validator');

var router = express.Router();

var verifyToken = authMiddleware.authenticate;
var verifyRole = authMiddleware.verifyRole;

router.get('/setup', verifyToken, verifyRole(['chain_admin']), otpController.setup2FA);
router.post('/verify', verifyToken, validate(otpValidator.verifyOtpSchema), otpController.verify2FA);

module.exports = router;
